sap.ui.define(
  ["sap/ui/core/UIComponent", "sync/ca/mm/vendorperformance/model/models"], // 경로 수정
  (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("sync.ca.mm.vendorperformance.Component", {
      metadata: {
        manifest: "json",
        interfaces: ["sap.ui.core.IAsyncContentCreation"], // 유지
      },

      init() {
        // call the base component's init function
        UIComponent.prototype.init.apply(this, arguments);

        // set the device model
        this.setModel(models.createDeviceModel(), "device");

        // enable routing
        this.getRouter().initialize();
      },
    });
  }
);
