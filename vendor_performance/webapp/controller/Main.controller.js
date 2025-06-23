sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
  ],
  function (Controller, Filter, FilterOperator, MessageToast) {
    "use strict";

    return Controller.extend("sync.ca.mm.vendorperformance.controller.Main", {
      onInit: function () {
        // 초기화 로직
      },

      onSearch: function (oEvent) {
        var aFilters = [];
        var sQuery = oEvent.getParameter("query");
        if (!sQuery && oEvent.getSource().getValue) {
          sQuery = oEvent.getSource().getValue();
        }

        if (sQuery && sQuery.length > 0) {
          var aSearchableFields = ["Lifnr", "Name1", "Saknr", "Zemail"]; // 검색 대상 필드
          var aFieldFilters = aSearchableFields.map(function (sFieldName) {
            return new Filter(sFieldName, FilterOperator.Contains, sQuery);
          });
          aFilters.push(
            new Filter({
              filters: aFieldFilters,
              and: false,
            })
          );
        }

        var oTable = this.byId("idVendorsTable");
        if (oTable) {
          var oBinding = oTable.getBinding("items");
          if (oBinding) {
            oBinding.filter(aFilters);
          }
        } else {
          MessageToast.show(
            this.getView()
              .getModel("i18n")
              .getResourceBundle()
              .getText("tableNotFound")
          );
        }
      },

      onListItemPress: function (oEvent) {
        var oItem = oEvent.getSource();
        var oBindingContext = oItem.getBindingContext();

        if (oBindingContext) {
          var sLifnr = oBindingContext.getProperty("Lifnr");
          var oRouter = this.getOwnerComponent().getRouter();
          oRouter.navTo("RouteDetail", {
            lifnrPath: sLifnr,
          });
        }
      },
    });
  }
);
