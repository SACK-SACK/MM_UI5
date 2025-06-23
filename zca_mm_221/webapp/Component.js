sap.ui.define([
    "sap/ui/core/UIComponent",
    "sync/c16/zcamm221/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("sync.c16.zcamm221.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // 전역 플래그
            window.qrCodeLoaded = false;
            jQuery.sap.includeStyleSheet("css/style.css");

            jQuery.sap.includeScript(
                jQuery.sap.getModulePath("sync.c16.zcamm221") + "/thirdparty/jsQR.js"
            );

            jQuery.sap.includeScript(
                jQuery.sap.getModulePath("sync.c16.zcamm221") + "/thirdparty/qrcode.min.js",
                null,
                () => {
                    console.log("✅ QRCode 라이브러리 로딩 완료");
                    window.qrCodeLoaded = true;
                }
            );
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();
        }
    });
});