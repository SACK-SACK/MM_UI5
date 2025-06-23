sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
  ],
  function (
    Controller,
    History,
    Filter,
    FilterOperator,
    JSONModel,
    MessageToast
  ) {
    "use strict";

    return Controller.extend(
      "sync.ca.mm.vendorperformance.controller.MaterialDetail",
      {
        onInit: function () {
          var oViewModel = new JSONModel({
            lifnr: "",
            ebeln: "",
          });
          this.getView().setModel(oViewModel, "view");

          var oRouter = this.getOwnerComponent().getRouter();
          oRouter
            .getRoute("RouteMaterialDetail")
            .attachPatternMatched(this._onObjectMatched, this);
        },

        _onObjectMatched: function (oEvent) {
          var sLifnr = oEvent.getParameter("arguments").lifnrPath;
          var sEbeln = oEvent.getParameter("arguments").ebelnPath;
          var oViewModel = this.getView().getModel("view");

          oViewModel.setProperty("/lifnr", sLifnr);
          oViewModel.setProperty("/ebeln", sEbeln);

          this._applyEbelnFilter(sEbeln);

          // Optional: Bind ObjectHeader to a specific item if needed,
          // or ensure i18n model is available for titles
          var oObjectHeader = this.byId("materialDetailObjectHeader");
          // Example: If you had a separate model for the header, you could bind it like:
          // oObjectHeader.bindElement({
          //  path: "ZCA_170_CDS>/ZCA_CDS_V_170(Ebeln='" + sEbeln + "',Ebelp='00010')", // Example for a specific item
          //  model: "ZCA_170_CDS"
          // });
          // For now, the title is set using the view model.
        },

        _applyEbelnFilter: function (sEbeln) {
          var oTable = this.byId("idMaterialItemsTable");
          var oBinding = oTable.getBinding("items");
          var oResourceBundle = this.getView()
            .getModel("i18n")
            .getResourceBundle();

          if (!sEbeln) {
            MessageToast.show(
              oResourceBundle.getText("purchaseOrderNumberMissingError")
            );
            oBinding.filter([]); // Clear any existing filters
            return;
          }

          var aFilters = [new Filter("Ebeln", FilterOperator.EQ, sEbeln)];

          oBinding.filter(aFilters);

          // Optional: Handle data loading events for busy indicators
          oBinding.attachDataRequested(
            function () {
              // this.getView().setBusy(true);
            }.bind(this)
          );

          oBinding.attachDataReceived(
            function (oDataEvent) {
              // this.getView().setBusy(false);
              if (oDataEvent.getParameter("error")) {
                MessageToast.show(
                  oResourceBundle.getText("materialItemLoadError")
                );
              }
            }.bind(this)
          );
        },

        onNavBack: function () {
          var oHistory = History.getInstance();
          var sPreviousHash = oHistory.getPreviousHash();
          var oRouter = this.getOwnerComponent().getRouter();

          // Clear view model if necessary
          var oViewModel = this.getView().getModel("view");
          oViewModel.setProperty("/lifnr", "");
          oViewModel.setProperty("/ebeln", "");

          // Clear table filter
          var oTable = this.byId("idMaterialItemsTable");
          if (oTable) {
            var oBinding = oTable.getBinding("items");
            if (oBinding) {
              oBinding.filter([]);
            }
          }

          if (sPreviousHash !== undefined) {
            window.history.go(-1);
          } else {
            // Navigate to Detail screen, passing back the lifnrPath if it was part of the context
            // For simplicity, navigate to a known previous route or main route.
            // Assuming you want to go back to the Detail view for the current vendor:
            var sLifnrForDetail = this.getView()
              .getModel("view")
              .getProperty("/lifnr"); // or however you stored it initially
            if (sLifnrForDetail) {
              oRouter.navTo(
                "RouteDetail",
                { lifnrPath: sLifnrForDetail },
                true
              );
            } else {
              oRouter.navTo("RouteMain", {}, true);
            }
          }
        },
      }
    );
  }
);
