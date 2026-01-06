export const ROUTE_SEGMENTS = {
  login: 'login',
  tree: 'tree',
  learn: 'learn',
  graph: 'graph',
  health: 'health'
} as const

export const ROUTES = {
  root: '/',
  login: `/${ROUTE_SEGMENTS.login}`,
  tree: `/${ROUTE_SEGMENTS.tree}`,
  learn: `/${ROUTE_SEGMENTS.learn}`,
  graph: `/${ROUTE_SEGMENTS.graph}`,
  health: `/${ROUTE_SEGMENTS.health}`
} as const
