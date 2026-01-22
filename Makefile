.PHONY: verify verify-curriculum-viewer smoke smoke-curriculum-viewer

verify: verify-curriculum-viewer

verify-curriculum-viewer:
	cd curriculum-viewer && npm test
	cd curriculum-viewer && npm run build
	cd curriculum-viewer && npm run validate:data

smoke: smoke-curriculum-viewer

smoke-curriculum-viewer:
	cd curriculum-viewer && npm run validate:data
	cd curriculum-viewer && npm run build
