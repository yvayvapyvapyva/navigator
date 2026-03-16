(function (global) {
  const { sendLaunchReport, sendRouteReport } = global.AppShared || {};
  global.TelegramTimeReport = {
    sendLaunchUserReport: sendLaunchReport,
    sendRouteLaunchReport: sendRouteReport
  };
})(window);
