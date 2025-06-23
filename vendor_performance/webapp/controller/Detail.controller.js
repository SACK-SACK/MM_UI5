sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/format/DateFormat",
    "sap/m/MessageToast",
  ],
  function (
    Controller,
    History,
    Filter,
    FilterOperator,
    JSONModel,
    DateFormat,
    MessageToast
  ) {
    "use strict";

    return Controller.extend("sync.ca.mm.vendorperformance.controller.Detail", {
      _sSelectedLifnr: null,

      onInit: function () {
        var oViewModel = new JSONModel({
          dateFrom: null,
          dateTo: null,
          appliedDateRangeText: "",
          transactionCount: 0,
          totalTransactionAmount: 0,
          currencyCode: "", // 거래 통화 코드
        });
        this.getView().setModel(oViewModel, "view");

        var oRouter = this.getOwnerComponent().getRouter();
        oRouter
          .getRoute("RouteDetail")
          .attachPatternMatched(this._onObjectMatched, this);
      },

      _onObjectMatched: function (oEvent) {
        this._sSelectedLifnr = oEvent.getParameter("arguments").lifnrPath;
        var oView = this.getView();
        var oViewModel = oView.getModel("view");
        var oResourceBundle = oView.getModel("i18n").getResourceBundle();

        var oToday = new Date();
        var oFirstDayOfYear = new Date(oToday.getFullYear(), 0, 1);
        oViewModel.setProperty("/dateFrom", oFirstDayOfYear);
        oViewModel.setProperty("/dateTo", oToday);

        var oUIDateFormat = DateFormat.getDateInstance({ style: "medium" });
        var sAppliedText = oResourceBundle.getText("appliedDateRange", [
          oUIDateFormat.format(oFirstDayOfYear),
          oUIDateFormat.format(oToday),
        ]);
        oViewModel.setProperty("/appliedDateRangeText", sAppliedText);

        oViewModel.setProperty("/transactionCount", 0);
        oViewModel.setProperty("/totalTransactionAmount", 0);
        oViewModel.setProperty("/currencyCode", "");

        if (this._sSelectedLifnr) {
          this._applyFiltersAndLoadTableData();
        } else {
          MessageToast.show(oResourceBundle.getText("vendorCodeInvalidError"));
          this._updateTableBindingWithFilters([]);
          this.getOwnerComponent().getRouter().navTo("RouteMain", {}, true);
          return;
        }

        // ObjectHeader 바인딩 (기본 모델 사용)
        var sObjectPath =
          "/" +
          this.getOwnerComponent().getModel().createKey("ZCA_CDS_V_190", {
            // 기본 모델의 엔티티셋명 확인 필요
            Lifnr: this._sSelectedLifnr,
          });

        oView.bindElement({
          path: sObjectPath, // 기본 모델 경로
          events: {
            dataRequested: function () {}.bind(this),
            dataReceived: function (oDataEvt) {
              if (!oDataEvt.getParameter("data")) {
                MessageToast.show(
                  oResourceBundle.getText("vendorInfoLoadError")
                );
                this.getOwnerComponent()
                  .getRouter()
                  .navTo("RouteMain", {}, true);
                return;
              }
            }.bind(this),
            change: function () {}.bind(this),
          },
        });
      },

      onApplyDateFilter: function () {
        var oViewModel = this.getView().getModel("view");
        oViewModel.setProperty("/transactionCount", 0);
        oViewModel.setProperty("/totalTransactionAmount", 0);
        oViewModel.setProperty("/currencyCode", "");
        this._applyFiltersAndLoadTableData();
      },

      _applyFiltersAndLoadTableData: function () {
        var oView = this.getView();
        if (!this._sSelectedLifnr) {
          return;
        }

        var oViewModel = oView.getModel("view");
        var oDateFrom = oViewModel.getProperty("/dateFrom");
        var oDateTo = oViewModel.getProperty("/dateTo");
        var oResourceBundle = oView.getModel("i18n").getResourceBundle();

        if (!oDateFrom || !oDateTo) {
          MessageToast.show(oResourceBundle.getText("dateRangeNotSelected"));
          oViewModel.setProperty("/appliedDateRangeText", "");
          this._updateTableBindingWithFilters([]);
          oViewModel.setProperty("/transactionCount", 0);
          oViewModel.setProperty("/totalTransactionAmount", 0);
          oViewModel.setProperty("/currencyCode", "");
          return;
        }
        if (oDateFrom > oDateTo) {
          MessageToast.show(oResourceBundle.getText("dateRangeInvalid"));
          oViewModel.setProperty("/appliedDateRangeText", "");
          this._updateTableBindingWithFilters([]);
          oViewModel.setProperty("/transactionCount", 0);
          oViewModel.setProperty("/totalTransactionAmount", 0);
          oViewModel.setProperty("/currencyCode", "");
          return;
        }

        var oDateTimeFormat = DateFormat.getDateTimeInstance({
          pattern: "yyyy-MM-ddTHH:mm:ss",
        });
        var aFilters = [
          // 테이블 모델(ZCA_180_CDS)의 벤더 코드 필드명이 Ltfnr라고 가정
          new Filter("Ltfnr", FilterOperator.EQ, this._sSelectedLifnr),
          // 테이블 모델(ZCA_180_CDS)의 문서일자 필드명이 Bedat라고 가정
          new Filter(
            "Bedat",
            FilterOperator.BT,
            oDateTimeFormat.format(
              new Date(new Date(oDateFrom).setHours(0, 0, 0, 0))
            ),
            oDateTimeFormat.format(
              new Date(new Date(oDateTo).setHours(23, 59, 59, 999))
            )
          ),
        ];

        this._updateTableBindingWithFilters(aFilters);

        var oUIDateFormat = DateFormat.getDateInstance({ style: "medium" });
        var sAppliedText = oResourceBundle.getText("appliedDateRange", [
          oUIDateFormat.format(oDateFrom),
          oUIDateFormat.format(oDateTo),
        ]);
        oViewModel.setProperty("/appliedDateRangeText", sAppliedText);
      },

      _updateTableBindingWithFilters: function (aFilters) {
        var oTable = this.byId("idTransactionsTable");
        if (!oTable) {
          MessageToast.show("거래내역 테이블을 찾을 수 없습니다.");
          return;
        }
        var oBinding = oTable.getBinding("items");
        if (!oBinding) {
          MessageToast.show("거래내역 테이블 바인딩을 찾을 수 없습니다.");
          return;
        }

        oBinding.detachDataRequested(this._onTableDataRequested, this);
        oBinding.detachDataReceived(this._onTableDataReceived, this);
        oBinding.attachDataRequested(this._onTableDataRequested, this);
        oBinding.attachDataReceived(this._onTableDataReceived, this);

        oBinding.filter(aFilters);
      },

      _onTableDataRequested: function () {
        // this.getView().setBusy(true);
      },

      _onTableDataReceived: function (oEvent) {
        // this.getView().setBusy(false);
        var oViewModel = this.getView().getModel("view");

        if (oEvent.getParameter("error")) {
          console.error(
            "Error receiving table data:",
            oEvent.getParameter("error")
          );
          MessageToast.show(
            this.getView()
              .getModel("i18n")
              .getResourceBundle()
              .getText("tableDataLoadError")
          );
          oViewModel.setProperty("/transactionCount", 0);
          oViewModel.setProperty("/totalTransactionAmount", 0);
          oViewModel.setProperty("/currencyCode", "");
          return;
        }

        var oBinding = oEvent.getSource();
        var aContexts = oBinding.getContexts();

        var iTransactionCount = aContexts.length;
        var fTotalAmount = 0;
        var sCurrencyCode = "";

        if (iTransactionCount > 0) {
          var firstItem = aContexts[0].getObject();
          if (firstItem && firstItem.Waers) {
            sCurrencyCode = firstItem.Waers;
          }
        }
        oViewModel.setProperty("/currencyCode", sCurrencyCode);

        var sAmountProperty = "Brtwr"; // View XML에서 ZCA_180_CDS>Brtwr 를 사용

        aContexts.forEach(function (oContext) {
          var oTransactionItem = oContext.getObject();
          if (
            oTransactionItem &&
            oTransactionItem[sAmountProperty] !== undefined &&
            oTransactionItem[sAmountProperty] !== null
          ) {
            var fAmount = parseFloat(
              String(oTransactionItem[sAmountProperty]).replace(/,/g, "")
            );
            if (!isNaN(fAmount)) {
              fTotalAmount += fAmount;
            } else {
              console.warn(
                "금액 속성 값이 유효한 숫자가 아닙니다:",
                oTransactionItem[sAmountProperty],
                "항목:",
                oTransactionItem
              );
            }
          }
        });

        var fDisplayAmount = fTotalAmount;
        if (sCurrencyCode === "KRW" || sCurrencyCode === "JPY") {
          fDisplayAmount = Math.round(fTotalAmount);
        } else {
          // fDisplayAmount = parseFloat(fTotalAmount.toFixed(2)); // 필요시 다른 통화도 소수점 2자리로 고정
        }

        oViewModel.setProperty("/transactionCount", iTransactionCount);
        oViewModel.setProperty("/totalTransactionAmount", fDisplayAmount);
      },

      onTransactionItemPress: function (oEvent) {
        var oItem = oEvent.getSource();
        var oBindingContext = oItem.getBindingContext("ZCA_180_CDS"); // 테이블 바인딩 모델명 명시

        if (!oBindingContext) {
          MessageToast.show("선택한 항목의 정보를 가져올 수 없습니다.");
          return;
        }

        var oItemData = oBindingContext.getObject();
        // ZCA_180_CDS 엔티티셋에 Ebeln 필드가 있다고 가정합니다. 실제 필드명으로 변경해야 합니다.
        var sEbeln = oItemData.Ebeln;

        if (!sEbeln) {
          MessageToast.show(
            "선택한 항목에서 오더 번호(Ebeln)를 찾을 수 없습니다."
          );
          return;
        }

        var oRouter = this.getOwnerComponent().getRouter();
        oRouter.navTo("RouteMaterialDetail", {
          lifnrPath: this._sSelectedLifnr, // 현재 화면의 벤더 코드도 함께 전달
          ebelnPath: sEbeln, // 선택된 오더 번호 전달
        });
      },

      onNavBack: function () {
        var oHistory = History.getInstance();
        var sPreviousHash = oHistory.getPreviousHash();
        var oRouter = this.getOwnerComponent().getRouter();

        var oViewModel = this.getView().getModel("view");
        oViewModel.setProperty("/dateFrom", null);
        oViewModel.setProperty("/dateTo", null);
        oViewModel.setProperty("/appliedDateRangeText", "");
        oViewModel.setProperty("/transactionCount", 0);
        oViewModel.setProperty("/totalTransactionAmount", 0);
        oViewModel.setProperty("/currencyCode", "");

        var oTable = this.byId("idTransactionsTable");
        if (oTable) {
          var oBinding = oTable.getBinding("items");
          if (oBinding) {
            oBinding.filter([]);
          }
        }

        if (sPreviousHash !== undefined) {
          window.history.go(-1);
        } else {
          oRouter.navTo("RouteMain", {}, true); // 기본 라우트명 확인 필요
        }
      },
    });
  }
);
