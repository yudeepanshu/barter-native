const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

/**
 * Workaround for OkHttp bug in React Native's BundleDownloader:
 * When Metro responds with Transfer-Encoding: chunked + Content-Type: multipart/mixed,
 * OkHttp's ChunkedSource.readChunkSize fails with ProtocolException ("Expected leading
 * [0-9a-fA-F] character but was 0xd"). Stripping the Accept: multipart/mixed request
 * header causes Metro to return a plain application/javascript bundle instead, which
 * OkHttp reads correctly via the non-multipart code path in BundleDownloader.
 */
const originalEnhanceMiddleware = config.server?.enhanceMiddleware;

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const base = originalEnhanceMiddleware
      ? originalEnhanceMiddleware(middleware, server)
      : middleware;

    return (req, res, next) => {
      if (req.headers && req.headers['accept'] === 'multipart/mixed') {
        req.headers['accept'] = 'application/javascript';
      }
      base(req, res, next);
    };
  },
};

// Limit watched folders to the shared packages directory to reduce watcher load.
const packagesRoot = path.resolve(workspaceRoot, 'packages');
if (fs.existsSync(packagesRoot)) {
  config.watchFolders = [...new Set([...(config.watchFolders || []), packagesRoot])];
}

/**
 * Redirect expo-router's renderRootComponent to our patched copy so that
 * ExpoKeepAwake.activate rejections are swallowed instead of crashing as
 * unhandled promise rejections on Android when the Activity is torn down.
 */
const patchedRenderRootComponent = path.resolve(
  projectRoot,
  'src/patches/renderRootComponent.js',
);
const originalResolveRequest = config.resolver?.resolveRequest;
config.resolver = {
  ...config.resolver,
    nodeModulesPaths: [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(workspaceRoot, "node_modules"),
  ],
  resolveRequest: (context, moduleName, platform) => {
    if (
      moduleName === 'expo-router/build/renderRootComponent' ||
      moduleName.endsWith('/expo-router/build/renderRootComponent')
    ) {
      return { filePath: patchedRenderRootComponent, type: 'sourceFile' };
    }
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
