// sap.ui.define([], function () {
//   "use strict";

//   return {
//     /**
//      * Wepos, Elikz 상태에 따라 캘린더 아이콘의 색상을 결정합니다.
//      * @param {boolean} bWepos Wepos 필드 값 (입고완료)
//      * @param {boolean} bElikz Elikz 필드 값 (운송완료)
//      * @returns {sap.ui.unified.CalendarDayType} 색상 타입
//      */
//     formatAppointmentType: function (bWepos, bElikz) {
//       if (bWepos) {
//         return "Type0A"; // 초록색 (입고 완료)
//       }
//       if (bElikz) {
//         return "Type01"; // 파란색 (운송 완료)
//       }
//       return "Type08"; // 노란색 (대기중/예정)
//     },

//     /**
//      * 드래그 가능 여부에 따라 아이콘 모양을 결정합니다.
//      * Wepos 또는 Elikz가 true이면 잠금 아이콘, 아니면 일반 아이콘.
//      * @param {boolean} bWepos Wepos 필드 값
//      * @param {boolean} bElikz Elikz 필드 값
//      * @returns {string} 아이콘 URI
//      */
//     formatAppointmentIcon: function (bWepos, bElikz) {
//       const isDraggable = !bWepos && !bElikz;
//       return isDraggable ? "sap-icon://shipping-status" : "sap-icon://locked";
//     },
//   };
// });
