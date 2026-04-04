const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

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

// Redirect expo-router's renderRootComponent to a patched copy that adds
// .catch(() => {}) to the _internal_preventAutoHideAsync setTimeout call,
// preventing unhandled "ExpoKeepAwake.activate" rejections on Android hot-reload.
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName === 'expo-router/build/renderRootComponent') {
      return {
        filePath: path.resolve(__dirname, 'src/patches/renderRootComponent.js'),
        type: 'sourceFile',
      };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
