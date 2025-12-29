export const ROUTE_SEGMENTS = {
  tree: 'tree',
  graph: 'graph',
  health: 'health'
} as const

export const ROUTES = {
  root: '/',
  tree: `/${ROUTE_SEGMENTS.tree}`,
  graph: `/${ROUTE_SEGMENTS.graph}`,
  health: `/${ROUTE_SEGMENTS.health}`
} as const
