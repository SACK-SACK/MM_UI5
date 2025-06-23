sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("sync.c16.zcamm231.controller.Main", {
        onInit: function () {
            var oSmartFilterBar = this.byId("smartFilterBar");

            // SmartFilterBar 검색 후 SmartChart 바인딩
            oSmartFilterBar.attachSearch(function () {
                var oSmartChart = this.byId("smartChart");
                if (oSmartChart) {
                    oSmartChart.rebindChart();
                }
            }.bind(this));
        }
    });
});