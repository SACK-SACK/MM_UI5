sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/m/MessageToast",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel",
    "sync/c16/zcamm221/util/Formatter"
], function (
    Controller,
    Filter,
    MessageToast,
    FilterOperator,
    MessageBox,
    JSONModel,
    Formatter
) {
    "use strict";

    return Controller.extend("sync.c16.zcamm221.controller.Batch", {
        formatter: Formatter,
        onInit: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            const oRoute = oRouter.getRoute("RouteBatch");
            const oTable = this.byId("batchTable");
            const oModel = this.getView().getModel();
            //
            oTable.attachEventOnce("updateFinished", () => {
                const oBinding = oTable.getBinding("items");
                if (oBinding) {
                    // Vfdat 기준 오름차순 정렬 (내림차순은 true)
                    oBinding.sort(new sap.ui.model.Sorter("Vfdat", false));
                }
            });
            //
            // Table 데이터 로드 완료 후 첫 번째 항목 바인딩 및 색상 계산
            oTable.attachEventOnce("updateFinished", () => {
                if (oBinding) {
                    // Btqty 기준 오름차순 정렬 (내림차순은 descending: true)
                    oBinding.sort(new sap.ui.model.Sorter("Btqty", true));
                }
                const aItems = oTable.getItems();

                if (!aItems || aItems.length === 0) return;

            });

            oTable.attachSelectionChange(this.onSelectionChange, this);

            if (oRoute && oRoute.attachPatternMatched) {
                oRoute.attachPatternMatched(this._onRouteMatched, this);
            }

            const oViewModel = new JSONModel({
                editMap: {}, // row별 수정 상태
                originalMap: {}     // 행별 BtqtyOriginal 저장용
            });
            this.getView().setModel(oViewModel, "viewModel");
        },

        // 기본 불러옴
        _onRouteMatched: function (oEvent) {
            const oArgs = oEvent.getParameter("arguments");
            const aFilters = [];

            if (oArgs.matnr) {
                console.log("[QR 필터] MATNR:", oArgs.matnr);
                aFilters.push(new Filter("Matnr", FilterOperator.EQ, oArgs.matnr));
            }
            if (oArgs.werks) {
                console.log("[QR 필터] WERKS:", oArgs.werks);
                aFilters.push(new Filter("Werks", FilterOperator.EQ, oArgs.werks));
            }
            if (oArgs.lgort) {
                console.log("[QR 필터] LGORT:", oArgs.lgort);
                aFilters.push(new Filter("Lgort", FilterOperator.EQ, oArgs.lgort));
            }

            const oTable = this.byId("batchTable");
            if (oTable) {
                const oBinding = oTable.getBinding("items");
                if (oBinding) {
                    oBinding.filter(aFilters);
                } else {
                    oTable.attachEventOnce("updateFinished", () => {
                        oTable.getBinding("items").filter(aFilters);
                    });
                }
            }
        },

        onPressEditBatch: function () {
            const oTable = this.byId("batchTable");
            const aSelectedItems = oTable.getSelectedItems();

            if (aSelectedItems.length === 0) {
                MessageBox.warning("수정할 항목을 선택하세요.");
                return;
            }

            aSelectedItems.forEach(oItem => {
                const oCtx = oItem.getBindingContext();
                oCtx.getModel().setProperty(oCtx.getPath() + "/Editmode", true);
            });

            MessageToast.show(`${aSelectedItems.length}개 항목이 수정 가능 상태로 전환되었습니다.`);
        },
        // onPressSaveBatch: function () {
        //     const oTable = this.byId("batchTable");
        //     const oModel = this.getView().getModel();
        //     let bValid = true;

        //     oTable.getItems().forEach(oItem => {
        //         const oCtx = oItem.getBindingContext();
        //         const oData = oCtx.getObject();

        //         // BtqtyOriginal이 없으면 현재 Btqty로 초기화 (최초 1회만)
        //         if (oData.BtqtyOriginal === undefined) {
        //             oModel.setProperty(oCtx.getPath() + "/BtqtyOriginal", oData.Btqty);
        //         }

        //         // 비교
        //         const fNew = parseFloat(oData.Btqty);
        //         const fOriginal = parseFloat(oData.BtqtyOriginal);
        //         if (fNew > fOriginal) {
        //             bValid = false;
        //             MessageBox.error(`수량은 기존값(${fOriginal})보다 작거나 같아야 합니다. [배치: ${oData.Charg}]`);
        //         }
        //     });

        //     if (!bValid) {
        //         return; // 저장 중단
        //     }

        //     // 모든 row 수정모드 해제
        //     oTable.getItems().forEach(oItem => {
        //         const oCtx = oItem.getBindingContext();
        //         oModel.setProperty(oCtx.getPath() + "/Editmode", false);
        //     });

        //     oModel.submitChanges({
        //         success: () => MessageToast.show("저장 완료"),
        //         error: () => MessageBox.error("저장 실패")
        //     });
        // },
        onPressSaveBatch: function () {
            const oTable = this.byId("batchTable");
            const oModel = this.getView().getModel();
            const oViewModel = this.getView().getModel("viewModel");
            const oOriginalMap = oViewModel.getProperty("/originalMap");
            let bValid = true;

            oTable.getItems().forEach(oItem => {
                const oCtx = oItem.getBindingContext();
                const oData = oCtx.getObject();
                const sKey = oData.Matnr + "_" + oData.Charg;

                const fNew = parseFloat(oData.Btqty);
                const fOriginal = parseFloat(oOriginalMap[sKey]);

                if (fNew > fOriginal) {
                    bValid = false;
                    MessageBox.error(`수량은 기존값(${fOriginal})보다 작거나 같아야 합니다. [배치: ${oData.Charg}]`);
                }
            });

            if (!bValid) return;

            // 수정모드 해제
            oTable.getItems().forEach(oItem => {
                const oCtx = oItem.getBindingContext();
                oModel.setProperty(oCtx.getPath() + "/Editmode", false);
            });

            oModel.submitChanges({
                success: () => MessageToast.show("저장 완료"),
                error: () => MessageBox.error("저장 실패")
            });
        },

        // onUpdateFinished: function (oEvent) {
        //     oEvent.getSource().getItems().forEach(oItem => {
        //         const oCtx = oItem.getBindingContext();
        //         // 최초 1회만 BtqtyOriginal 세팅
        //         if (oCtx.getProperty("BtqtyOriginal") === undefined) {
        //             oCtx.getModel().setProperty(oCtx.getPath() + "/BtqtyOriginal", oCtx.getProperty("Btqty"));
        //         }
        //         var oVfdat = oCtx.getProperty("Vfdat");
        //         var sStyleClass = this.formatter.getRowColorClass(oVfdat);
        //         oItem.addStyleClass(sStyleClass);
        //     });
        // }
        // onUpdateFinished: function (oEvent) {
        //     const oTable = this.byId("batchTable");
        //     const aItems = oTable.getItems();

        //     if (aItems && aItems.length > 0) {
        //         const oViewModel = this.getView().getModel("viewModel");

        //         aItems.forEach((oItem, index) => {
        //             const oCtx = oItem.getBindingContext();
        //             const oModel = oCtx.getModel();

        //             // 최초 1회만 BtqtyOriginal 세팅 (이미 값 있으면 덮어쓰지 않음)
        //             if (oCtx.getProperty("BtqtyOriginal") === undefined) {
        //                 oModel.setProperty(oCtx.getPath() + "/BtqtyOriginal", oCtx.getProperty("Btqty"));
        //             }

        //             // 유통기한에 따라 행 색상 지정
        //             const oVfdat = oCtx.getProperty("Vfdat");
        //             const sStyleClass = this.formatter.getRowColorClass(oVfdat);
        //             oItem.addStyleClass(sStyleClass);

        //             // 첫 번째 행은 header 모델에 저장
        //             if (index === 0) {
        //                 const oData = oCtx.getObject();
        //                 oViewModel.setProperty("/header", {
        //                     Matnr: oData.Matnr,
        //                     Maktx: oData.Maktx,
        //                     Werks: oData.Werks,
        //                     Pname: oData.Pname,
        //                     Lgort: oData.Lgort,
        //                     Lgobe: oData.Lgobe
        //                 });
        //             }
        //         });
        //     }
        // }
        onUpdateFinished: function (oEvent) {
            const oTable = this.byId("batchTable");
            const aItems = oTable.getItems();

            const oViewModel = this.getView().getModel("viewModel");
            const oOriginalMap = oViewModel.getProperty("/originalMap") || {};

            if (aItems.length > 0) {
                aItems.forEach((oItem, index) => {
                    const oCtx = oItem.getBindingContext();
                    const oData = oCtx.getObject();

                    // originalMap에 Btqty 저장
                    const sKey = oData.Matnr + "_" + oData.Charg;
                    if (oOriginalMap[sKey] === undefined) {
                        oOriginalMap[sKey] = oData.Btqty;
                    }

                    // 행 색상 지정
                    const oVfdat = oData.Vfdat;
                    const sStyleClass = this.formatter.getRowColorClass(oVfdat);
                    oItem.addStyleClass(sStyleClass);

                    // 첫 번째 행의 header 정보
                    if (index === 0) {
                        oViewModel.setProperty("/header", {
                            Matnr: oData.Matnr,
                            Maktx: oData.Maktx,
                            Werks: oData.Werks,
                            Pname: oData.Pname,
                            Lgort: oData.Lgort,
                            Lgobe: oData.Lgobe
                        });
                    }
                });

                oViewModel.setProperty("/originalMap", oOriginalMap);
            }
        }

    });
});
