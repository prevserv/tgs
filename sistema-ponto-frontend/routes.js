window.APP_ROUTES = {
  dashboard: { path: "/dashboard", viewId: "view-dashboard" },
  ponto: { path: "/ponto", viewId: "view-ponto" },
  consultas: { path: "/consultas", viewId: "view-consultas" },
  adminUsers: { path: "/admin/users", viewId: "view-admin-users" },
  adminAlerts: { path: "/admin/alerts", viewId: "view-admin-alerts" },
};

window.routeToViewId = function routeToViewId(routePath) {
  const routes = Object.values(window.APP_ROUTES);
  const found = routes.find((r) => r.path === routePath);
  return found ? found.viewId : window.APP_ROUTES.dashboard.viewId;
};

window.viewIdToRoute = function viewIdToRoute(viewId) {
  const routes = Object.values(window.APP_ROUTES);
  const found = routes.find((r) => r.viewId === viewId);
  return found ? found.path : window.APP_ROUTES.dashboard.path;
};
