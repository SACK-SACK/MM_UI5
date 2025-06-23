sap.ui.define([], function () {
    "use strict";
    console.log("포메터 로딩됨");
    return {
        isRowEditMode: function (oRowData, oContext) {
            const oView = sap.ui.getCore().byId("batchView");
            if (!oView) return false;
            const mEditMap = oView.getModel("viewModel").getProperty("/editMap") || {};
            const sPath = oContext.getPath();
            console.log("isRowEditMode", sPath, mEditMap[sPath]);
            return !!mEditMap[sPath];
        },
        isRowReadMode: function (oRowData, oContext) {
            return !this.isRowEditMode(oRowData, oContext);
        },
        // getRowColorClass: function (vDate) {
        //     console.log("🧪 [Formatter] vDate:", vDate);
        //     if (!vDate) return "cell-green"; // 기본 초록색

        //     const expiry = new Date(vDate).getTime();
        //     const now = Date.now();
        //     const diff = expiry - now;

        //     const oneDay = 24 * 60 * 60 * 1000;

        //     if (diff < 3 * oneDay) {
        //         return "cell-red"; // 3일 이내
        //     } else if (diff < 7 * oneDay) {
        //         return "cell-yellow"; // 7일 이내
        //     } else {
        //         return "cell-green"; // 그 외
        //     }
        // }
        // }
        // getRowColorClass: function (vDate) {
        //     console.log("✅ getRowColorClass 호출됨", vDate);
        //     if (!vDate) return "cell-green";

        //     const date = new Date(vDate).getTime();
        //     const now = Date.now();
        //     const oneDay = 24 * 60 * 60 * 1000;
        //     const diff = date - now;

        //     if (diff < 3 * oneDay) return "cell-red";
        //     if (diff < 7 * oneDay) return "cell-yellow";
        //     return "cell-green";
        // }
        getRowColorClass: function (vDate) {
            console.log("✅ getRowColorClass 호출됨", vDate);

            if (!vDate) return "cell-green";

            let parsedDate;

            // 문자열일 경우 수동 파싱
            if (typeof vDate === "string") {
                // yyyy.MM.dd 형식 처리
                if (vDate.includes(".")) {
                    const parts = vDate.split(".");
                    if (parts.length === 3) {
                        parsedDate = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
                    }
                } else {
                    // 기본 문자열은 Date에 그대로 넣어보기
                    parsedDate = new Date(vDate);
                }
            } else {
                parsedDate = new Date(vDate);
            }

            if (isNaN(parsedDate)) {
                console.warn("⚠️ 유통기한 날짜 형식이 잘못됨:", vDate);
                return "cell-green"; // fallback
            }

            const date = parsedDate.getTime();
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            const diff = date - now;

            if (diff < 3 * oneDay) return "cell-red";
            if (diff < 7 * oneDay) return "cell-yellow";
            return "cell-green";
        }


    };
});
