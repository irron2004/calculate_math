export const ROUTE_SEGMENTS = {
  login: 'login',
  signup: 'signup',
  tree: 'tree',
  learn: 'learn',
  graph: 'graph',
  health: 'health'
} as const

export const ROUTES = {
  root: '/',
  login: `/${ROUTE_SEGMENTS.login}`,
  signup: `/${ROUTE_SEGMENTS.signup}`,
  tree: `/${ROUTE_SEGMENTS.tree}`,
  learn: `/${ROUTE_SEGMENTS.learn}`,
  graph: `/${ROUTE_SEGMENTS.graph}`,
  health: `/${ROUTE_SEGMENTS.health}`
} as const
