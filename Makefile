SHELL := /bin/bash

.PHONY: all clean publish

all:
	pushd serialize-closures; npm run build; popd
	pushd ts-closure-transform; npm run build; popd

test:
	pushd serialize-closures; npm test; popd
	pushd ts-closure-transform; npm test; popd

clean:
	rm -rf serialize-closures/dist
	rm -rf ts-closure-transform/dist
	rm -rf serialize-closures/src/*.js
	rm -rf ts-closure-transform/src/*.js

publish:
	pushd serialize-closures; npm version patch && npm publish; popd
	pushd ts-closure-transform; npm version patch && npm publish; popd

publish-prerelease:
	pushd serialize-closures; npm version prerelease --preid=next && npm publish; popd
	pushd ts-closure-transform; npm version prerelease --preid=next && npm publish; popd
