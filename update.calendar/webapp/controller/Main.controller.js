sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/ui/core/date/UI5Date",
    "sap/ui/unified/library", // CalendarAppointment 타입을 위해 필요
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox", // 사용자에게 오류/경고 메시지를 표시하기 위해
  ],
  function (
    Controller,
    JSONModel,
    MessageToast,
    Fragment,
    UI5Date,
    unifiedLibrary,
    Filter,
    FilterOperator,
    MessageBox
  ) {
    "use strict";

    return Controller.extend("sync.ca.mm.update.calendar.controller.Main", {
      /**
       * @method onInit
       * 컨트롤러가 초기화될 때 호출되는 라이프사이클 훅.
       * 모델을 초기화하고 OData 데이터를 로드합니다.
       */
      onInit: function () {
        const oView = this.getView();

        // 캘린더 기본 모델 (SinglePlanningCalendar 바인딩용) 초기화
        oView.setModel(
          new JSONModel({
            startDate: UI5Date.getInstance(), // 캘린더 시작 날짜를 현재 날짜로 설정
            appointments: [], // 캘린더에 표시될 약속 데이터 (필터링된 결과)
            allAppointments: [], // 모든 약속 데이터 (필터링되지 않은 원본)
            selectedAppointment: null, // 현재 선택된 약속 (필요시 사용)
          })
        );

        // 캘린더 데이터 모델 (OData에서 로드될 실제 약속 데이터) 초기화
        oView.setModel(new JSONModel({}), "calendar");

        // 캘린더 설정 모델 초기화 (드래그앤드롭, 리사이즈, 생성 가능 여부)
        oView.setModel(
          new JSONModel({
            stickyMode: "All", // 헤더 고정 모드 (예: "All", "None", "Headers")
            enableAppointmentsDragAndDrop: false, // 기본값: 드래그앤드롭 비활성화 (체크박스로 제어)
            enableAppointmentsResize: false, // 기본값: 리사이즈 비활성화 (체크박스로 제어)
            enableAppointmentsCreate: false, // 기본값: 생성 비활성화 (체크박스로 제어)
            enableEditMode: false, // 수정 모드 체크박스 상태 추가 (기본값: false)
          }),
          "settings"
        );

        // 요약 정보 모델 초기화 (IconTabBar의 각 탭 카운트용)
        oView.setModel(
          new JSONModel({
            Total: 0, // 전체 카운트
            Type01: 0, // 운송 완료 카운트
            Type02: 0, // 입고 완료 카운트
            Type03: 0, // 운송 중 카운트
            Type04: 0, // 입고 실패 카운트
          }),
          "summaryModel"
        );

        // 범례 모델 초기화 (캘린더 약속 타입 설명용)
        oView.setModel(
          new JSONModel({
            supportedAppointmentItems: [
              { text: "운송 완료", type: "Type01" },
              { text: "운송 중", type: "Type03" },
              { text: "입고 완료", type: "Type02" },
              { text: "입고 실패", type: "Type04" },
            ],
          }),
          "legend"
        );

        // OData V2 모델 초기화
        this.oODataModel = new sap.ui.model.odata.v2.ODataModel(
          "/sap/opu/odata/sap/ZCA_GW_210_SRV/"
        );

        // 초기 약속 데이터 로드
        this._loadAppointments();
      },

      /**
       * @method _loadAppointments
       * OData 서비스에서 구매오더 데이터를 읽어와 캘린더 약속 데이터 및 요약 카운트를 업데이트합니다.
       * 이 함수는 데이터 초기 로드 및 데이터 변경 후 새로고침 시 사용됩니다.
       */
      _loadAppointments: function () {
        // ZCACDSV180Set 엔티티셋에서 데이터를 읽어옵니다.
        this.oODataModel.read("/ZCACDSV180Set", {
          // urlParameters: OData 쿼리 옵션 설정
          urlParameters: {
            $orderby: "Bedat desc", // 구매오더 일자(Bedat)를 기준으로 최신순(내림차순) 정렬
            $top: 100, // 상위 100개 데이터만 가져옴
          },
          /**
           * 데이터 읽기 성공 콜백 함수.
           * @param {object} oData OData 서비스에서 반환된 데이터 객체
           */
          success: (oData) => {
            // 요약 카운트 초기화
            const counts = {
              Total: 0,
              Type01: 0,
              Type02: 0,
              Type03: 0,
              Type04: 0,
            };
            var grouped = []; // 캘린더 약속 형식으로 변환될 데이터 배열
            var aData = oData.results; // OData 결과 배열

            // 현재 날짜를 시간 없이 얻기 (입고 실패 로직에 사용)
            const oToday = UI5Date.getInstance();
            oToday.setHours(0, 0, 0, 0);

            // OData 결과 데이터를 순회하며 캘린더 약속 형식으로 변환하고 상태별 카운트 집계
            for (var i = 0; i < aData.length; i++) {
              var item = aData[i]; // 현재 처리 중인 OData 항목

              // Indat (입고완료 일자)와 Bedat (구매오더 일자)를 Date 객체로 변환하고 시간 초기화
              const delvDate = item.Indat ? new Date(item.Indat) : null;
              delvDate?.setHours(0, 0, 0, 0);
              const beDat = new Date(item.Bedat);
              beDat?.setHours(0, 0, 0, 0);
              var type = ""; // 캘린더 약속의 타입 (Type01, Type02, Type03, Type04)

              // --- 데이터 상태 분류 로직 시작 ---
              if (item.Elikz === true && item.Wepos === true) {
                type = "Type02"; // 운송 완료(Elikz) & 입고 완료(Wepos) 모두 true: 입고 완료
              } else if (item.Elikz === true && item.Wepos === false) {
                type = "Type01"; // 운송 완료(Elikz)는 true, 입고 완료(Wepos)는 false: 운송 완료
              } else if (item.Elikz === false && item.Wepos === false) {
                // 운송 완료(Elikz) & 입고 완료(Wepos) 모두 false:
                // 입고일(Indat)이 존재하고 오늘 날짜보다 미래인 경우
                if (delvDate && delvDate.getTime() > oToday.getTime()) {
                  type = "Type04"; // 입고 실패 (캘린더에 표시됨)
                } else {
                  type = "Type03"; // 그 외의 경우: 운송 중 (기본값)
                }
              } else {
                // 예외 케이스 (예: Elikz=false, Wepos=true는 비즈니스 로직상 발생해서는 안 됨)
                // 만약 발생한다면, 기본값으로 '운송 중'으로 분류
                type = "Type03";
              }
              // --- 데이터 상태 분류 로직 끝 ---

              // type이 설정된 경우에만 캘린더 약속 데이터로 추가
              if (type) {
                let titleText = "";
                // 약속 제목 텍스트 설정
                if (type === "Type02") {
                  titleText = `입고: ${item.Ebeln || ""}`;
                } else if (type === "Type01") {
                  titleText = `운송: ${item.Ebeln || ""}`;
                } else if (type === "Type03") {
                  titleText = `운송중: ${item.Ebeln || ""}`;
                } else if (type === "Type04") {
                  titleText = `입고 실패: ${item.Ebeln || ""}`;
                }

                // grouped 배열에 캘린더 약속 객체 추가
                grouped.push({
                  Ebeln: item.Ebeln, // 구매오더 코드 (키 값)
                  type: type, // 약속 타입 (색상, 아이콘 등 결정)
                  startDate: delvDate || beDat, // 약속 시작 날짜 (입고일 우선, 없으면 구매오더일)
                  endDate: delvDate || beDat, // 약속 종료 날짜 (시작 날짜와 동일하게 설정)
                  text: `${item.Name1 || ""} / ${item.Werks || ""}`, // 약속 본문 텍스트 (벤더명 / 플랜트)
                  title: titleText, // 약속 제목
                  icon: "", // 약속 아이콘 (기본값, 타입에 따라 자동 결정될 수도 있음)
                  Wepos: item.Wepos, // 현재 Wepos 값 (체크박스 로직에 재활용)
                  Elikz: item.Elikz, // 현재 Elikz 값 (체크박스 로직에 재활용)
                  Indat: item.Indat, // Indat 원본 값 (필요시 사용)
                  Bedat: item.Bedat, // Bedat 원본 값 (새로운 제약 조건에 사용)
                });
                counts[type]++; // 해당 타입의 카운트 증가
                counts.Total++; // 전체 카운트 증가
              }
            }

            const appts = Object.values(grouped); // 최종 캘린더 약속 데이터 배열

            // 캘린더 모델 업데이트
            var oModel = this.getView().getModel("calendar");
            oModel.setProperty("/appointments", appts); // 현재 캘린더에 표시될 약속
            oModel.setProperty("/allAppointments", appts); // 모든 약속 (필터링 원본)

            // 요약 모델 업데이트 (IconTabBar 카운트)
            this.getView().getModel("summaryModel").setData(counts);

            // --- 필터링 상태 유지 로직 시작 ---
            // 현재 IconTabBar의 선택된 키를 가져옵니다.
            const currentSelectedKey =
              this.byId("statusTabBar").getSelectedKey();

            // 만약 현재 선택된 키가 'All'이 아니고 유효한 키라면, 해당 필터링을 다시 적용합니다.
            // 이렇게 하면 데이터를 새로고침해도 현재 필터 상태가 유지됩니다.
            if (currentSelectedKey && currentSelectedKey !== "All") {
              this.onTabSelect({ getParameter: () => currentSelectedKey });
            } else {
              // 'All' 탭이 선택되어 있거나, 초기 로드 시에는 'allAppointments'가 이미 'appointments'에 설정되어 있으므로
              // 별도로 필터링을 다시 할 필요가 없습니다.
              oModel.setProperty("/appointments", appts);
            }
            // --- 필터링 상태 유지 로직 끝 ---
          },
          /**
           * 데이터 읽기 실패 콜백 함수.
           * @param {object} oError OData 서비스에서 반환된 오류 객체
           */
          error: () => MessageBox.error("데이터를 불러오는 데 실패했습니다."),
        });
      },

      /**
       * @method onTabSelect
       * IconTabBar의 탭 선택 시 호출되는 이벤트 핸들러.
       * 선택된 탭에 따라 캘린더 약속 데이터를 필터링하여 표시합니다.
       * @param {sap.ui.base.Event} oEvent 탭 선택 이벤트 객체
       */
      onTabSelect: function (oEvent) {
        const key = oEvent.getParameter("key"); // 선택된 탭의 key (예: "All", "Type03")
        const model = this.getView().getModel("calendar"); // 캘린더 데이터 모델
        const all = model.getProperty("/allAppointments") || []; // 필터링되지 않은 모든 약속 데이터

        // 선택된 키가 "All"이면 모든 약속을 표시하고, 아니면 해당 타입으로 필터링
        const filtered =
          key === "All" ? all : all.filter((e) => e.type === key);

        // 캘린더에 표시될 약속 데이터를 필터링된 결과로 업데이트
        model.setProperty("/appointments", filtered);
      },

      /**
       * @method handleAppointmentSelect
       * SinglePlanningCalendar에서 약속(CalendarAppointment)을 선택했을 때 호출되는 이벤트 핸들러.
       * 선택된 약속의 상세 정보를 보여주는 팝업 다이얼로그를 엽니다.
       * @param {sap.ui.base.Event} oEvent 약속 선택 이벤트 객체
       */
      handleAppointmentSelect: function (oEvent) {
        const oAppointmentControl = oEvent.getParameter("appointment"); // 선택된 약속 컨트롤
        if (!oAppointmentControl) {
          return;
        }

        const sEbelnValue = oAppointmentControl.getProperty("key"); // 약속의 키 (Ebeln)
        const oView = this.getView();
        const oODataModel = this.oODataModel;
        oView.setBusy(true); // 뷰를 바쁜 상태로 설정 (로딩 인디케이터 표시)

        // OData 서비스에서 ZCACDSV180Set 데이터를 다시 읽어옴 (상세 정보 확인용)
        // 약속 선택 시에는 해당 Ebeln에 해당하는 전체 데이터가 필요할 수 있으므로,
        // 현재는 `$orderby`와 `$top`을 유지하여 최신 100개 데이터 내에서 필터링
        oODataModel.read("/ZCACDSV180Set", {
          urlParameters: {
            $orderby: "Bedat desc",
            $top: 100,
          },
          success: (oPoItemData) => {
            oView.setBusy(false); // 뷰의 바쁜 상태 해제

            // 클라이언트 측 필터링: 가져온 모든 데이터 중 선택된 Ebeln에 해당하는 항목만 필터링
            const aAllItems = oPoItemData.results;
            const aPoItems = aAllItems.filter(function (oItem) {
              return oItem.Ebeln === sEbelnValue;
            });

            // 필터링 결과에 따라 다이얼로그 열기
            if (!aPoItems || aPoItems.length === 0) {
              console.log(
                `No items found for Ebeln ${sEbelnValue} after client-side filtering.`
              );
              this._openItemDetailDialog(sEbelnValue, []); // 항목이 없으면 빈 배열로 다이얼로그 열기
            } else {
              console.log(
                `Found ${aPoItems.length} items for Ebeln ${sEbelnValue} after client-side filtering.`
              );
              this._openItemDetailDialog(sEbelnValue, aPoItems); // 항목이 있으면 해당 데이터로 다이얼로그 열기
            }
          },
          error: (oListError) => {
            oView.setBusy(false); // 뷰의 바쁜 상태 해제
            MessageBox.error("데이터를 조회하는 중 오류가 발생했습니다.");
            console.error(
              "Error fetching data from ZCACDSV180Set: ",
              oListError
            );
          },
        });
      },

      /**
       * @method _openItemDetailDialog
       * 약속 상세 정보를 표시하는 Fragment 기반 팝업 다이얼로그를 엽니다.
       * @param {string} sEbelnWithPrefix 구매오더 코드
       * @param {Array} aItems 해당 구매오더에 해당하는 상세 항목 데이터 배열
       */
      _openItemDetailDialog: function (sEbelnWithPrefix, aItems) {
        const oView = this.getView();
        // 다이얼로그가 아직 로드되지 않았다면 Fragment 로드
        if (!this._pItemDetailDialog) {
          this._pItemDetailDialog = Fragment.load({
            id: oView.getId(),
            name: "sync.ca.mm.update.calendar.view.ItemDetailDialog", // 다이얼로그 View Fragment 경로
            controller: this, // 다이얼로그 컨트롤러 (현재 컨트롤러 사용)
          }).then((oDialog) => {
            oView.addDependent(oDialog); // 뷰에 다이얼로그를 종속시켜 라이프사이클 관리
            return oDialog;
          });
        }
        // 다이얼로그가 로드되면 모델 설정 후 열기
        this._pItemDetailDialog.then((oDialog) => {
          oDialog.setModel(
            new JSONModel({ Ebeln: sEbelnWithPrefix, Items: aItems }),
            "dialogModel" // 다이얼로그에 바인딩될 모델 설정
          );
          oDialog.open();
        });
      },

      /**
       * @method onCloseItemDetailDialog
       * 약속 상세 정보 팝업 다이얼로그의 닫기 버튼 클릭 시 호출되는 이벤트 핸들러.
       * 다이얼로그를 닫고, 메인 캘린더 데이터를 새로고침하여 변경 사항을 반영합니다.
       */
      onCloseItemDetailDialog: function () {
        if (this._pItemDetailDialog) {
          this._pItemDetailDialog.then((oDialog) => {
            oDialog.close(); // 다이얼로그 닫기
            this._loadAppointments(); // 메인 캘린더 데이터 새로고침
          });
        }
      },

      /**
       * @method onCheckboxSelect
       * 상세 정보 다이얼로그 내의 체크박스(Wepos, Elikz) 선택 시 호출되는 이벤트 핸들러.
       * 체크박스 상태 변경 및 OData 업데이트, 유효성 검사를 수행합니다.
       * @param {sap.ui.base.Event} oEvent 체크박스 선택 이벤트 객체
       */
      onCheckboxSelect: function (oEvent) {
        const oCheckbox = oEvent.getSource(); // 이벤트 발생시킨 체크박스 컨트롤
        let bIsSelected = oCheckbox.getSelected(); // 체크박스의 현재 선택 상태 (true/false)
        const sFieldName = oCheckbox.data("field"); // 체크박스가 연결된 필드명 ('Wepos' 또는 'Elikz')
        const oBindingContext = oCheckbox.getBindingContext("dialogModel"); // 체크박스 바인딩 컨텍스트
        const oCurrentItem = oBindingContext.getObject(); // 현재 행의 모든 데이터 (모델에서 가져옴)

        const sEbeln = oCurrentItem.Ebeln; // 구매오더 코드
        const bCurrentWepos = oCurrentItem.Wepos; // 현재 입고 완료 여부
        const bCurrentElikz = oCurrentItem.Elikz; // 현재 운송 완료 여부

        // --- 체크박스 제약 조건 로직 시작 ---

        // 1. 운송 완료 (Elikz) 체크박스 제약 조건: 입고 완료된 건은 운송 완료 상태를 해제할 수 없음
        //   - 변경하려는 필드가 Elikz이고
        //   - Elikz를 false로 변경하려는 시도이고 (bIsSelected === false)
        //   - 현재 Wepos가 true인 경우 (이미 입고 완료 상태)
        if (
          sFieldName === "Elikz" &&
          bIsSelected === false &&
          bCurrentWepos === true
        ) {
          MessageBox.warning(
            "⚠️ 입고 완료된 건은 운송 완료 상태를 해제할 수 없습니다."
          );
          oCheckbox.setSelected(true); // 체크박스 원상복구 (false로 변경하려 했으나 true로 유지)
          return; // 업데이트 로직 실행 중단
        }

        // 2. 입고 완료 (Wepos) 체크박스 제약 조건: 운송 완료가 안된 건은 입고 완료할 수 없음
        //   - 변경하려는 필드가 Wepos이고
        //   - Wepos를 true로 변경하려는 시도이고 (bIsSelected === true)
        //   - 현재 Elikz가 false인 경우 (운송 완료 안됨)
        if (
          sFieldName === "Wepos" &&
          bIsSelected === true &&
          bCurrentElikz === false
        ) {
          MessageBox.warning(
            "⚠️ 운송 완료되지 않은 건은 입고 완료할 수 없습니다. 운송 완료를 먼저 해주세요."
          );
          oCheckbox.setSelected(false); // 체크박스 원상복구
          return; // 업데이트 로직 실행 중단
        }
        // --- 체크박스 제약 조건 로직 끝 ---

        // OData 업데이트를 위한 payload 생성
        const oPayload = { [sFieldName]: bIsSelected };
        // OData 업데이트를 위한 경로 (Ebeln을 키로 사용)
        const sPath = this.oODataModel.createKey("/ZCACDSV180Set", {
          Ebeln: sEbeln,
        });

        // OData 서비스에 업데이트 요청 전송
        this.oODataModel.update(sPath, oPayload, {
          /**
           * OData 업데이트 성공 콜백 함수.
           */
          success: () => {
            MessageToast.show("✅ 상태가 성공적으로 변경되었습니다.");
            // 다이얼로그의 JSON 모델 데이터를 업데이트하여 UI에 즉시 반영
            oBindingContext.setProperty(sFieldName, bIsSelected);
            // 캘린더 전체 데이터 새로고침은 팝업 닫기 시에 수행되므로 여기서는 주석 처리
            // this._loadAppointments();
          },
          /**
           * OData 업데이트 실패 콜백 함수.
           * @param {object} oError OData 서비스에서 반환된 오류 객체
           */
          error: (oError) => {
            oCheckbox.setSelected(!bIsSelected); // 실패 시 체크박스 상태 원상복구
            let sDetail = "알 수 없는 오류가 발생했습니다.";
            // OData 오류 메시지 파싱 시도
            try {
              sDetail =
                JSON.parse(oError.responseText)?.error?.message?.value ||
                sDetail;
            } catch (e) {
              /* JSON 파싱 실패 시 기본 메시지 유지 */
            }
            MessageBox.error(`❌ 상태 변경 실패:\n\n${sDetail}`); // 오류 메시지 표시
            console.error("OData Update Error:", oError); // 콘솔에 오류 로그
          },
        });
      },

      /**
       * @method onToggleEdit
       * '수정 모드 활성화' 체크박스 선택 시 호출되는 이벤트 핸들러.
       * 캘린더의 드래그앤드롭, 리사이즈, 생성 기능을 활성화/비활성화합니다.
       * @param {sap.ui.base.Event} oEvent 체크박스 선택 이벤트 객체
       */
      onToggleEdit: function (oEvent) {
        const bEditMode = oEvent.getParameter("selected");
        const oSettingsModel = this.getView().getModel("settings");

        oSettingsModel.setProperty("/enableAppointmentsDragAndDrop", bEditMode);
        oSettingsModel.setProperty("/enableAppointmentsResize", bEditMode);
        oSettingsModel.setProperty("/enableAppointmentsCreate", bEditMode);
        MessageToast.show(`수정 모드: ${bEditMode ? "활성화" : "비활성화"}`);
      },

      /**
       * @method handleMoreLinkPress
       * SinglePlanningCalendar의 "더 보기" 링크 클릭 시 호출되는 이벤트 핸들러.
       * 해당 날짜의 일간 뷰로 이동하고 메시지 토스트를 표시합니다.
       * @param {sap.ui.base.Event} oEvent "더 보기" 링크 클릭 이벤트 객체
       */
      handleMoreLinkPress: function (oEvent) {
        const oDate = oEvent.getParameter("date"); // 클릭된 날짜
        const oCalendar = this.byId("SPC1"); // 캘린더 컨트롤 참조

        // 캘린더에 뷰가 정의되어 있으면 첫 번째 뷰(일간 뷰)로 설정
        if (oCalendar.getViews().length > 0) {
          oCalendar.setSelectedView(oCalendar.getViews()[0].getKey());
        }
        // 캘린더의 시작 날짜를 클릭된 날짜로 설정
        this.getView().getModel().setProperty("/startDate", oDate);
        MessageToast.show(`📅 ${oDate.toLocaleDateString()} 일정으로 이동`); // 메시지 토스트 표시
      },

      /**
       * @method handleAppointmentDrop
       * SinglePlanningCalendar에서 약속을 다른 날짜로 드래그앤드롭했을 때 호출되는 이벤트 핸들러.
       * 약속의 입고일(Indat)을 업데이트하고, 미래 날짜로의 변경 및 BEDAT 이전 날짜로의 변경을 제한합니다.
       * @param {sap.ui.base.Event} oEvent 약속 드롭 이벤트 객체
       */
      handleAppointmentDrop: function (oEvent) {
        const oAppointment = oEvent.getParameter("appointment"); // 드롭된 약속 컨트롤
        const oNewDate = oEvent.getParameter("startDate"); // 드롭된 새 시작 날짜
        const oOldDate = oAppointment.getStartDate(); // 드롭 전의 기존 시작 날짜

        // 약속 데이터에서 Bedat 가져오기
        // allAppointments에서 해당 Ebeln(key)에 맞는 약속을 찾아 Bedat을 가져옵니다.
        const allAppointments = this.getView()
          .getModel("calendar")
          .getProperty("/allAppointments");
        const selectedAppointmentData = allAppointments.find(
          (appt) => appt.Ebeln === oAppointment.getProperty("key")
        );
        const oBedat = selectedAppointmentData
          ? new Date(selectedAppointmentData.Bedat)
          : null;
        oBedat?.setHours(0, 0, 0, 0); // 시간 초기화

        // --- 입고일 날짜 변경 제약 조건 시작 ---
        // 1. 현재 날짜보다 미래 불가
        const oToday = UI5Date.getInstance();
        oToday.setHours(0, 0, 0, 0);
        const oNewDateOnly = UI5Date.getInstance(oNewDate);
        oNewDateOnly.setHours(0, 0, 0, 0);

        if (oNewDateOnly.getTime() > oToday.getTime()) {
          MessageBox.warning("⚠️ 입고일은 미래 날짜로 변경할 수 없습니다.");
          return;
        }

        // 2. BEDAT보다 과거 불가 (신규 제약)
        if (oBedat && oNewDateOnly.getTime() < oBedat.getTime()) {
          MessageBox.warning(
            `⚠️ 입고일은 구매오더 일자(${oBedat.toLocaleDateString()})보다 과거로 변경할 수 없습니다.`
          );
          return;
        }
        // --- 입고일 날짜 변경 제약 조건 끝 ---

        // OData 서비스로 전송할 UTC 날짜 생성 (시간은 00:00:00으로)
        const oUTCDate = new Date(
          Date.UTC(
            oNewDate.getFullYear(),
            oNewDate.getMonth(),
            oNewDate.getDate()
          )
        );

        // OData 업데이트를 위한 경로 (Ebeln을 키로 사용)
        const sPath = this.oODataModel.createKey("/ZCACDSV180Set", {
          Ebeln: oAppointment.getProperty("key"),
        });
        // OData 업데이트를 위한 payload (Indat 필드만 변경)
        const oPayload = { Indat: oUTCDate };

        // UI에 먼저 날짜 변경 반영 (성공 시 유지, 실패 시 롤백)
        oAppointment.setStartDate(oNewDate);
        oAppointment.setEndDate(oNewDate);

        // OData 서비스에 업데이트 요청 전송
        this.oODataModel.update(sPath, oPayload, {
          /**
           * OData 업데이트 성공 콜백 함수.
           */
          success: () => {
            MessageToast.show("✅ 입고일이 성공적으로 변경되었습니다.");
            this._loadAppointments(); // 캘린더 데이터 새로고침 (변경 사항 반영)
          },
          /**
           * OData 업데이트 실패 콜백 함수.
           * @param {object} oError OData 서비스에서 반환된 오류 객체
           */
          error: (oError) => {
            // 실패 시 UI를 이전 날짜로 롤백
            oAppointment.setStartDate(oOldDate);
            oAppointment.setEndDate(oOldDate);
            let sDetail = "알 수 없는 오류";
            // OData 오류 메시지 파싱 시도
            try {
              sDetail =
                JSON.parse(oError.responseText)?.error?.message?.value ||
                "상세정보 없음";
            } catch (e) {
              /* JSON 파싱 실패 시 기본 메시지 유지 */
            }
            MessageBox.error(`❌ 입고일 변경 실패:\n\n${sDetail}`); // 오류 메시지 표시
            console.error("OData Update Error:", oError); // 콘솔에 오류 로그
          },
        });
      },
    });
  }
);
