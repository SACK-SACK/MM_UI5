/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"syncc16/zca_mm_221/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});
