sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/core/HTML"
], function (Controller, Fragment, JSONModel, MessageToast, HTML) {
    "use strict";

    return Controller.extend("sync.c16.zcamm221.controller.Main", {
        onInit: function () {
            const oSmartTable = this.byId("smartTable");

            // SmartTable 초기화 후 Table 접근 및 선택 모드 설정
            oSmartTable.attachInitialise(() => {
                const oTable = oSmartTable.getTable();

                if (oTable && oTable.setMode) {
                    oTable.setMode("SingleSelectLeft");
                }

                if (oTable && oTable.attachRowSelectionChange) {
                    oTable.attachRowSelectionChange(this.onPressButton, this);
                }

                // 그룹핑 수동 적용: SmartTable의 내부 바인딩 전에 sorter 삽입
                oSmartTable.attachBeforeRebindTable(this.onBeforeRebindTable, this);
            });

            // 자동 컬럼 너비 조정
            oSmartTable.setEnableAutoColumnWidth(true);

            // Row 선택 이벤트 핸들러 연결
            oSmartTable.attachInitialise(() => {
                this._attachRowSelectionHandler();
            });

            // 검색 버튼 누를 때 테이블 갱신
            this.byId("smartFilterBar").attachSearch(() => {
                oSmartTable.rebindTable();
            });

            // 필드 그룹 설정
            oSmartTable.setFieldGroupIds(["MATNR", "WERKS", "LGORT"]);
        },

        _attachRowSelectionHandler: function () {
            const oTable = this.byId("smartTable").getTable();
            if (oTable && oTable.attachRowSelectionChange) {
                oTable.detachRowSelectionChange(this._onRowSelectionChanged, this);
                oTable.attachRowSelectionChange(this._onRowSelectionChanged, this);
            }
        },

        onPressButton: function () {
            const oTable = this.byId("smartTable").getTable();
            const aSelectedItems = oTable.getSelectedItems();

            if (aSelectedItems.length === 0) {
                MessageToast.show("행을 선택해주세요.");
                return;
            }

            const oContext = aSelectedItems[0].getBindingContext();
            const oData = oContext.getObject();
            console.log("Parsed Data:", oData);
            const parsedTSTOCK = parseFloat(oData.TSTOCK.replace(/,/g, ""));
            const parsedEISBE = parseFloat(oData.EISBE?.replace?.(/,/g, "") || "0");
            const parsedUMLME = parseFloat(oData.UMLME?.replace?.(/,/g, "") || "0");
            const EISBE_X2 = parsedEISBE * 2;
            const EISBE_X10 = parsedEISBE * 5;

            let TSTOCK_COLOR = "Good";
            if (parsedTSTOCK < parsedEISBE) {
                TSTOCK_COLOR = "Error";
            } else if (parsedTSTOCK < EISBE_X2) {
                TSTOCK_COLOR = "Critical";
            }
            const oParsedData = {
                ...oData,
                TSTOCK: parsedTSTOCK,
                EISBE: parsedEISBE,
                UMLME: parsedUMLME,
                EISBE_X2: EISBE_X2,
                EISBE_X10: EISBE_X10,
                TSTOCK_COLOR: TSTOCK_COLOR
            };
            console.log("Parsed Data:", oParsedData);
            if (!oData || !oData.MATNR) {
                MessageToast.show("데이터가 없습니다.");
                return;
            }
            // QR 코드 생성
            if (!this._oDialog) {
                Fragment.load({
                    name: "sync.c16.zcamm221.view.Checkstock",
                    type: "XML",
                    controller: this
                }).then((oDialog) => {
                    this._oDialog = oDialog;
                    this.getView().addDependent(this._oDialog);

                    // 항상 이벤트 등록
                    this._oDialog.detachAfterOpen(this._onAfterOpenQR, this);
                    this._oDialog.attachAfterOpen(this._onAfterOpenQR, this);

                    this._oDialog.setModel(new JSONModel(oParsedData));
                    this._oDialog.open();
                });
            } else {
                this._oDialog.detachAfterOpen(this._onAfterOpenQR, this);
                this._oDialog.attachAfterOpen(this._onAfterOpenQR, this);
                this._oDialog.setModel(new JSONModel(oParsedData));
                this._oDialog.open();
            }
        },
        // 컨트롤러에 추가
        _onAfterOpenQR: function () {
            const oData = this._oDialog.getModel().getData();
            this._generateQRCodeForMATNR(oData.MATNR, oData.WERKS, oData.LGORT);
        },

        onDialogClose: function () {
            if (this._oDialog) {
                this._oDialog.close();
            }
        },
        onPressQRScan: function () {
            if (!this.byId("qrDialog")) {
                this.loadFragment({
                    name: "sync.c16.zcamm221.view.QRDialog"
                }).then(oDialog => {
                    this.getView().addDependent(oDialog);
                    oDialog.open();
                    MessageToast.show("QR 스캔을 시작합니다.");
                });
            } else {
                this.byId("qrDialog").open();
            }
        },

        onAfterOpenQRDialog: function () {
            const oVBox = this.byId("qrContentBox");
            const domRef = oVBox.getDomRef();

            // video 태그 삽입
            if (domRef && !domRef.querySelector("video")) {
                const video = document.createElement("video");
                video.setAttribute("id", "video");
                video.setAttribute("autoplay", true);
                video.setAttribute("playsinline", true);
                video.style.width = "100%";
                video.style.maxHeight = "300px";
                video.style.border = "1px solid #ccc";
                domRef.appendChild(video);

                const canvas = document.createElement("canvas");
                canvas.setAttribute("id", "canvas");
                canvas.style.display = "none";
                domRef.appendChild(canvas);

                this._startCamera(); // ✅ 카메라 시작
            }
        },

        onCloseQRDialog: function () {
            const video = document.getElementById("video");
            if (video && video.srcObject) {
                video.srcObject.getTracks().forEach(track => track.stop());
                video.srcObject = null;
            }
            this.byId("qrDialog").close();
        },

        _startCamera: function () {
            const video = document.getElementById("video");
            const canvas = document.getElementById("canvas");
            const ctx = canvas.getContext("2d");

            navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment",
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            })
                .then(stream => {

                    video.srcObject = stream;
                    video.play();
                    console.log("카메라 연결 성공");
                    const scan = () => {
                        console.log("스캔 중...", video.readyState);
                        // 비디오가 충분히 로드되었는지 확인
                        if (video.readyState === video.HAVE_ENOUGH_DATA) {
                            canvas.width = video.videoWidth;
                            canvas.height = video.videoHeight;
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);


                            const code = jsQR(imageData.data, imageData.width, imageData.height);
                            if (code) {

                                const scannedData = code.data;

                                // 메시지 보여주기
                                sap.m.MessageToast.show(`QR 인식됨: ${scannedData}`, {
                                    duration: 2000
                                });

                                try {
                                    const parsed = JSON.parse(scannedData); // QR 값 파싱

                                    // 라우터로 Batch 화면 이동
                                    this.getOwnerComponent().getRouter().navTo("RouteBatch", {
                                        matnr: parsed.MATNR,
                                        werks: parsed.WERKS,
                                        lgort: parsed.LGORT
                                    });

                                } catch (e) {
                                    console.error("QR 파싱 실패", e);
                                    sap.m.MessageToast.show("QR 형식이 잘못되었습니다.");
                                }

                                // 카메라 종료 및 Dialog 닫기
                                video.srcObject.getTracks().forEach(track => track.stop());
                                this.byId("qrDialog").close();
                                return;
                            } else {
                                console.log("QR 코드 인식 실패");
                            }
                        }
                        requestAnimationFrame(scan);
                    };

                    requestAnimationFrame(scan);
                })
                .catch(err => {
                    console.error("카메라 접근 실패", err.name, err.message);
                    sap.m.MessageToast.show("카메라 접근 실패: " + err.message);
                });
        },

        _generateQRCodeForMATNR: function (matnr, WERKS, LGORT) {
            const container = document.getElementById("qrDisplayArea");

            if (!container) {
                console.warn("❗ QR 표시 영역(qrDisplayArea)을 찾을 수 없습니다.");
                return;
            }

            container.innerHTML = ""; // 기존 QR 제거

            if (typeof QRCode === "undefined") {
                console.error("❌ QRCode 라이브러리가 아직 로드되지 않았습니다.");
                return;
            }
            // const qrText = `MATNR:${matnr}, WERKS:${WERKS}, LGORT:${LGORT}`;
            const qrText = JSON.stringify({
                MATNR: matnr,
                WERKS: WERKS,
                LGORT: LGORT,
            });

            new QRCode(container, {
                text: qrText,
                width: 100,
                height: 100
            });
        },
        onBeforeRebindTable: function (oEvent) {
            const oBindingParams = oEvent.getParameter("bindingParams");

            oBindingParams.template = new sap.m.ColumnListItem({
                cells: [
                    new sap.m.Image({
                        src: "{image_url}",
                        width: "64px",
                        height: "64px"
                    }),
                    new sap.m.Text({ text: "{/matnr}" })
                    // ... 다른 필드들도 여기에 추가
                ]
            });
        },
        // onBeforeRebindTable: function (oEvent) {
        //     const oBindingParams = oEvent.getParameter("bindingParams");

        //     // ✔️ 그룹핑 + 정렬 적용
        //     oBindingParams.sorter = [
        //         new sap.ui.model.Sorter("PNAME", false, true)
        //     ];
        //     console.log("oBindingParams.sorter:", oBindingParams.sorter);

        //     // ✔️ 그룹 헤더 표시용 팩토리 설정
        //     const oTable = this.byId("smartTable").getTable();
        //     if (oTable && oTable.setGroupHeaderFactory) {
        //         oTable.setGroupHeaderFactory(function (oGroup) {
        //             return new sap.m.GroupHeaderListItem({
        //                 title: "플랜트: " + oGroup.key,
        //                 upperCase: false
        //             });
        //         });
        //     }
        //     console.log("oGroup:", oBindingParams.sorter);
        // }

    });
});
