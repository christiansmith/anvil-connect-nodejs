'use strict'
/**
 * Module dependencies
 */

var qs = require('qs')
var url = require('url')
var async = require('async')
var request = require('request-promise')
var clientRoles = require('./rest/clientRoles')
var clients = require('./rest/clients')
var roles = require('./rest/roles')
var roleScopes = require('./rest/roleScopes')
var scopes = require('./rest/scopes')
var users = require('./rest/users')
var userRoles = require('./rest/userRoles')
var IDToken = require('./lib/IDToken')
var AccessToken = require('./lib/AccessToken')
var UnauthorizedError = require('./errors/UnauthorizedError')
var JWT = require('anvil-connect-jwt')

/**
 * OpenID Connect client (also an Anvil Connect server API client).
 * @class AnvilConnect
 * @param [options={}] {Object} Options hashmap object
 * @param [options.agentOptions={}] {Object} Optional, passed to `request`
 *   library (see npm's `request` or `request-promise` for documentation)
 * @param [options.proxy={}] {Object} Optional, passed to `request`
 *  library (see npm's `request` or `request-promise` for documentation)
 * @param [options.issuer] {String} URL of the OIDC Provider. Required for
 *   most operations.
 * @param [options.scope] {Array|String} Either an array or a space-separated
 *   string list of scopes. Defaults to `'openid profile'`
 * @param [options.client_id] {String} Client ID (obtained after registering
 *   the client with the OP, either via `nvl client:register` cli tool, or
 *   via Dynamic Registration (`client.register()`).
 * @param [options.client_secret] {String} Client Secret (obtained after
 *   registering the client with the OP, either via `nvl client:register` cli
 *   tool, or via Dynamic Registration (`client.register()`).
 * @param [options.redirect_uri] {String} Optional client redirect endpoint
 * @param [options.configuration] {Object} Provider API endpoints, etc (usually
 *   loaded via `initProvider()`, unless you explicitly pass them in here)
 * @param [options.jwks] {Object} Issuer public keys (usually loaded via
 *   `initProvider()`, unless you explicitly pass them to the constructor)
 * @param [options.registration] {Object} Client dynamic registration details
 *   (usually loaded via `register()`, unless explicitly passed in here)
 * @constructor
 */
function AnvilConnect (options) {
  options = options || {}

  // assign required options
  this.issuer = options.issuer
  this.client_id = options.client_id
  this.client_secret = options.client_secret
  this.redirect_uri = options.redirect_uri
  this.configuration = options.configuration
  this.jwks = options.jwks
  this.registration = options.registration
  this.agentOptions = options.agentOptions
  this.proxy = options.proxy

  this.scope = 'openid profile'  // Init to default
  this.addScope(options.scope)   // Set Union any additional scopes passed in

  // initialize the Anvil Connect admin API
  this.initAdminAPI()
}

/**
 * Adds the passed in list of scopes to the current one via a Set union
 * operation.
 * @param scope {Array|String} Either an array or a space-separated
 *   string list of scopes.
 * @method addScope
 */
function addScope (scope) {
  if (!scope) {
    return
  }
  var oldScope = new Set(this.scope.split(' '))
  var newScope
  // Convert the incoming new scopes to a Set
  if (typeof scope === 'string') {
    newScope = new Set(scope.split(' '))
  } else if (Array.isArray(scope)) {
    newScope = new Set(scope)
  } else {
    throw new RangeError('Trying to add an invalid scope object')
  }
  oldScope.forEach(function (item) {
    newScope.add(item)
  })
  // Convert back to string
  this.scope = Array.from(newScope).join(' ')
}
AnvilConnect.prototype.addScope = addScope

/**
 * Errors
 */
AnvilConnect.UnauthorizedError = UnauthorizedError

/**
 * Requests OIDC configuration from the AnvilConnect instance's provider.
 * Requires issuer to be set.
 * @method discover
 * @return {Promise}
 */
function discover () {
  var self = this

  // construct the uri
  var uri = url.parse(this.issuer)
  uri.pathname = '.well-known/openid-configuration'
  uri = url.format(uri)

  var requestOptions = {
    url: uri,
    method: 'GET',
    json: true,
    agentOptions: self.agentOptions
  }
  if (self.proxy) {
    requestOptions.proxy = self.proxy
  }
  // return a promise
  return new Promise(function (resolve, reject) {
    request(requestOptions)
      .then(function (data) {
        // data will be an object if the server returned JSON
        if (typeof data === 'object') {
          self.configuration = data
          resolve(data)
          // If data is not an object, the server is not serving
          // .well-known/openid-configuration as expected
        } else {
          reject(new Error('Unable to retrieve OpenID Connect configuration'))
        }
      })
      .catch(function (err) {
        reject(err)
      })
  })
}
AnvilConnect.prototype.discover = discover

/**
 * Decodes an OIDC issuer (`.iss`) url from an access token and returns it.
 * @param token {String} JWT Access Token (in encoded string form)
 * @return {String}
 */
function extractIssuer (token) {
  if (!token) {
    return
  }
  // Decode the JWT. Skip verification (since we need an issuer to verify)
  var claims = JWT.decode(token, null, { noVerify: true })
  return claims.payload.iss
}
AnvilConnect.prototype.extractIssuer = extractIssuer

/**
 * Fetches and returns a Client Credentials Grant access token from the OP's
 * /token endpoint. Convenience method (wrapper for client.token()).
 * Used as one of the methods to get the token that's required for most
 * AnvilConnect API client operations (such as creating Users, Clients, etc).
 * Requires that the client:
 *   - Has been pre-registered with the AnvilConnect server
 *   - Had an 'authority' role assigned to it via `nvl client:assign`
 *   - Has been initialized via client.initProvider()
 * Usage:
 *
 *   ```
 *   client.getClientAccessToken()
 *     .then(function (accessToken) {
 *       // you can now use the AnvilConnect API calls, and pass the token
 *       // in the `options` parameter. For example:
 *       var options = { token: accessToken }
 *       return client.users.create(userData, options)
 *     })
 *   ```
 * @method getClientAccessToken
 * @return {Promise<Request>}
 */
function getClientAccessToken () {
  return this
    .token({
      grant_type: 'client_credentials',
      scope: 'realm'
    })
    .then(function (tokenResponse) {
      return tokenResponse.access_token
    })
}
AnvilConnect.prototype.getClientAccessToken = getClientAccessToken

/**
 * Requests JSON Web Key set from configured provider.
 * Requires provider info to be initialized (like via `discover()`).
 * @method getJWKs
 * @return {Promise}
 */
function getJWKs () {
  var self = this
  var uri = this.configuration.jwks_uri

  var requestOptions = {
    url: uri,
    method: 'GET',
    json: true,
    agentOptions: self.agentOptions
  }
  if (self.proxy) {
    requestOptions.proxy = self.proxy
  }

  return new Promise(function (resolve, reject) {
    request(requestOptions)
      .then(function (data) {
        // make it easier to reference the JWK by use
        data.keys.forEach(function (jwk) {
          data[jwk.use] = jwk
        })

        // make the JWK set available on the client
        self.jwks = data
        resolve(data)
      })
      .catch(function (err) {
        reject(err)
      })
  })
}
AnvilConnect.prototype.getJWKs = getJWKs

/**
 * Initializes the Anvil Connect admin API functions. Called by constructor.
 * @private
 * @method initAdminAPI
 */
function initAdminAPI () {
  this.clients = {
    list: clients.list.bind(this),
    get: clients.get.bind(this),
    create: clients.create.bind(this),
    update: clients.update.bind(this),
    delete: clients.delete.bind(this),
    roles: {
      list: clientRoles.listRoles.bind(this),
      add: clientRoles.addRole.bind(this),
      delete: clientRoles.deleteRole.bind(this)
    }
  }

  this.roles = {
    list: roles.list.bind(this),
    get: roles.get.bind(this),
    create: roles.create.bind(this),
    update: roles.update.bind(this),
    delete: roles.delete.bind(this),
    scopes: {
      list: roleScopes.listScopes.bind(this),
      add: roleScopes.addScope.bind(this),
      delete: roleScopes.deleteScope.bind(this)
    }
  }

  this.scopes = {
    list: scopes.list.bind(this),
    get: scopes.get.bind(this),
    create: scopes.create.bind(this),
    update: scopes.update.bind(this),
    delete: scopes.delete.bind(this)
  }

  this.users = {
    list: users.list.bind(this),
    get: users.get.bind(this),
    getByEmail: users.getByEmail.bind(this),
    create: users.create.bind(this),
    update: users.update.bind(this),
    updatePassword: users.updatePassword.bind(this),
    delete: users.delete.bind(this),

    roles: {
      list: userRoles.listRoles.bind(this),
      add: userRoles.addRole.bind(this),
      delete: userRoles.deleteRole.bind(this)
    }
  }
}
AnvilConnect.prototype.initAdminAPI = initAdminAPI

/**
 * Initializes provider-related configurations for this client
 * (loads OP endpoints via `discover()` and keys via `getJWKs()`).
 * Requires the issuer to be already set. Usage:
 *
 *   ```
 *   var client = new AnvilConnect({ issuer: 'https://example.com' })
 *   client.initProvider()
 *     .then(function () {
 *       // now the client is ready to register() or verify()
 *     })
 *     .catch(function (err) {
 *       // handle error
 *     })
 *   ```
 * @method initProvider
 * @throws {Error} If `issuer` is not configured
 * @return {Promise}
 */
function initProvider () {
  if (!this.issuer) {
    throw new Error('initClient requires an issuer to be configured')
  }
  var self = this
  return self.discover()
    .then(function () {
      return self.getJWKs()
    })
}
AnvilConnect.prototype.initProvider = initProvider

/**
 * Registers the client with an OIDC provider.
 * Requires that the OIDC provider's registration endpoint is loaded
 * (say, via `initProvider()`)
 *
 * @method register
 * @param options {Object} Options hashmap of registration params
 * @param options.redirect_uris {Array<String>} Client callback URLs, for
 *   redirecting users after authentication. REQUIRED.
 * @param [options.client_name] {String} Name of the client app or service
 * @param [options.client_uri] {String} Reference app URL (displayed to user)
 * @param [options.logo_uri] {String} Client logo (displayed to user)
 * @param [options.response_types] {Array<String>} List of allowed
 *   response types. Allowed values are: either some combination of
 *   `code`, `token` or `id_token`, OR `none` by itself.
 *   Defaults to `['code']`
 * @param [options.grant_types] {Array<String>} List
 *   of allowed grant types. Defaults to `['authorization_code']`.
 * @param [options.default_max_age] {Number} Token expiration, in seconds
 * @param [options.post_logout_redirect_uris] {Array<String>}
 * @param [options.trusted] {Boolean} Is the client part of your security
 *   realm (is a privileged client), or is it a third party.
 * @param [options.default_client_scope] {Array<String>} List of client
 *   access token scopes issued by a client_credentials grant.
 *   For example: ['profile', 'realm']
 * @param [options.token] {String} Access token (for scoped (non-dynamic) client
 *   registartion).
 * @throws {Error} If `redirect_uris` are missing.
 * @return {Promise<Object>} Resolves to client configs/metadata
 *   returned from the provider (also sets the relevant client attributes).
 */
function register (options) {
  var self = this
  var url = this.configuration.registration_endpoint
  var token = options.token
  if (!options.redirect_uris) {
    throw new Error('Missing required redirect_uris parameter for registration')
  }
  var requestOptions = {
    url: url,
    method: 'POST',
    json: options,
    agentOptions: self.agentOptions
  }
  if (token) {
    requestOptions.headers = {
      'Authorization': 'Bearer ' + token
    }
  }
  if (self.proxy) {
    requestOptions.proxy = self.proxy
  }
  return Promise.resolve()
    .then(function () {
      return request(requestOptions)
    })
    .then(function (data) {
      self.client_id = data.client_id
      self.client_secret = data.client_secret
      self.registration = data
      return data
    })
}
AnvilConnect.prototype.register = register

/**
 * Returns the client's pre-registered post-logout redirect URIs if it
 * registered any, or an empty array otherwise. For use with `signout()`.
 * @method registeredPostLogoutUris
 * @return {Array} List of pre-registered post-logout redirect URIs, if any
 */
function registeredPostLogoutUris () {
  var uris
  if (!this.registration) {
    return []
  }
  uris = this.registration.post_logout_redirect_uris || []
  return uris
}
AnvilConnect.prototype.registeredPostLogoutUris = registeredPostLogoutUris

/**
 * Returns the url for an OIDC authorization call, for a given set of options.
 * @method authorizationUri
 * @param [options={}] {String|Object} Either a string representing an endpoint
 *   (such as 'authorize'), or an options hashmap.
 *   For a full list of options, see the docstring of `authorizationParams()`.
 * @param [options.endpoint='authorize'] Endpoint for which you're building the
 *   uri.
 * @return {String} Authorization uri
 */
function authorizationUri (options) {
  var u = url.parse(this.configuration.authorization_endpoint)

  // assign endpoint and ensure options
  var endpoint = 'authorize'
  if (typeof options === 'string') {
    endpoint = options
    options = {}
  } else if (typeof options === 'object') {
    endpoint = options.endpoint
  } else {
    options = {}
  }

  // pathname
  u.pathname = endpoint

  // request params
  u.query = this.authorizationParams(options)

  return url.format(u)
}
AnvilConnect.prototype.authorizationUri = authorizationUri

/**
 * Composes and returns a hashmap of parameters used for any sort of OIDC
 * request, both the required ones (like the client_id, scope, etc) and the
 * optional ones. Mainly used by `authorizationUri()`.
 * @method authorizationParams
 * @private
 * @param [options={}]
 * @param [options.acr_values]
 * @param [options.display]
 * @param [options.email]
 * @param [options.id_token_hint]
 * @param [options.login_hint]
 * @param [options.max_age]
 * @param [options.nonce]
 * @param [options.password]
 * @param [options.post_logout_redirect_uri] {String} For `signout()` requests
 * @param [options.prompt]
 * @param [options.provider]
 * @param [options.redirect_uri]
 * @param [options.response_type='code']
 * @param [options.scope]
 * @param [options.state]
 * @param [options.ui_locales]
 * @return {Object} Hashmap of OIDC request parameters
 */
function authorizationParams (options) {
  // ensure options is defined
  options = options || {}

  // essential request params
  var params = {
    response_type: options.response_type || 'code',
    client_id: this.client_id,
    redirect_uri: options.redirect_uri || this.redirect_uri,
    scope: options.scope || this.scope
  }

  // optional request params
  var optionalParameters = [
    'email',
    'password',
    'provider',
    'state',
    'response_mode',
    'nonce',
    'display',
    'prompt',
    'max_age',
    'ui_locales',
    'id_token_hint',
    'login_hint',
    'post_logout_redirect_uri',
    'acr_values'
  ]

  // assign optional request params
  optionalParameters.forEach(function (param) {
    if (options[param]) {
      params[param] = options[param]
    }
  })

  return params
}
AnvilConnect.prototype.authorizationParams = authorizationParams

/**
 * Sends an OIDC refresh token request, verifies the result, and resolves to
 * the new (refreshed) token.
 * @method refresh
 * @param options {Object} Options hashmap
 * @param options.refresh_token {AccessToken} Token to be refreshed (required)
 * @return {Promise<AccessToken>}
 */
function refresh (options) {
  options = options || {}

  var self = this
  var refreshToken = options.refresh_token
  if (!refreshToken) {
    return Promise.reject(new Error('Missing refresh_token'))
  }
  return new Promise(function (resolve, reject) {
    AccessToken.refresh(refreshToken, {
      issuer: self.issuer,
      client_id: self.client_id,
      client_secret: self.client_secret
    }, function (err, token) {
      if (err) {
        return reject(err)
      }
      AccessToken.verify(token.access_token, {
        key: self.jwks.keys[0],
        issuer: self.issuer
      }, function (err) {
        if (err) {
          return reject(err)
        }
        return resolve(token)
      })
    })
  })
}
AnvilConnect.prototype.refresh = refresh

/**
 * Returns a string representation of the client config options. These can be
 * used to persist a fully initialized and registered client in any kind of
 * client store (useful for multi-provider federated signin scenarios).
 * Usage:
 *
 *   ```
 *   var serializedClient = client.serialize()
 *   // To deserialize later on:
 *   var clientConfig = JSON.parse(serializedClient)
 *   var restoredClient = new AnvilConnect(clientConfig)
 *   ```
 * @method serialize
 * @return {String} JSON representation of the full client config
 */
function serialize () {
  return JSON.stringify(this)
}
AnvilConnect.prototype.serialize = serialize

/**
 * Sends a POST request to the provider's `/signout` endpoint, to end a user's
 *   session.
 * @method signout
 * @param idToken {String} ID Token of the user to sign out. Required.
 *   Used as `id_token_hint` by the OIDC provider
 * @param [postLogoutRedirectUri] {String} Must be one of the post-logout uris
 *   pre-registered by the client.
 * @return {Promise<Request>}
 */
function signout (idToken, postLogoutRedirectUri) {
  if (!idToken) {
    return Promise.reject(new Error('ID Token required for signout'))
  }
  var params = {}
  params.id_token_hint = idToken
  if (postLogoutRedirectUri) {
    params.post_logout_redirect_uri = postLogoutRedirectUri
  }
  var options = {
    endpoint: 'signout'
  }
  var uri = this.authorizationUri(options)
  var self = this
  var requestOptions = {
    url: uri,
    method: 'POST',
    json: params,
    agentOptions: self.agentOptions
  }
  if (self.proxy) {
    requestOptions.proxy = self.proxy
  }

  return Promise.resolve()
    .then(function () {
      return request(requestOptions)
    })
}
AnvilConnect.prototype.signout = signout

/**
 * Provides a low-level interface to the server's `/token` REST endpoint.
 * Using this method requires that the client has been already registered with
 * the provider, and initialized via `initProvider()`.
 * Useful for:
 *
 *   1. Sending an `authorization_code` grant type request (to exchange
 *     an access code for an ID token in the Auth OIDC flow). Requires either
 *     `options.code` to be set, or `options.responseUri`.
 *   2. Making a `client_credentials` grant type request (though use
 *     the `client.getClientAccessToken()` convenience method, instead).
 *     Requires that the client was assigned an `authority` role, after
 *     after registration.
 *   3. Refreshing an expired token (requires `options.refresh_token` to be set)
 *     Use `client.refresh()` convenience method instead.
 * @method token
 * @param [options] {Object} Options hashmap object
 * @param [options.responseUri] {String} Redirect URL received from a request
 *   (parsed to extract the authorization code)
 * @param [options.code] {String}  Authorization code.
 * @param [options.grant_type='authorization_code'] {String}
 * @param [options.redirect_uri] {String} OIDC Redirect URL
 *   (not needed for a grant_type == 'client_credentials')
 * @param [options.scope] {String} Optional scope
 * @param [options.refresh_token] {String} Token to be refreshed (used with
 *   grant_type == 'refresh_token').
 * @return {Promise}
 */
function token (options) {
  options = options || {}

  var self = this
  var uri = this.configuration.token_endpoint
  var code = options.code
  var grantType = options.grant_type || 'authorization_code'
  var scope = options.scope || self.scope
  var redirectUri = options.redirect_uri || self.redirect_uri
  var refreshToken = options.refresh_token
  var formRequestData

  if (grantType === 'client_credentials') {
    // 'client_credentials' grants do not need a code or redirect uri
    // Assumes this client is registered and has had the 'authority' role
    // added to it previously
    formRequestData = {
      grant_type: grantType,
      scope: scope
    }
  } else if (grantType === 'refresh_token') {
    if (!refreshToken) {
      return Promise.reject(
        new Error('Refresh token grant types require refresh_token'))
    }
    formRequestData = {
      grant_type: grantType,
      refresh_token: refreshToken,
      scope: scope
    }
  } else {
    // For 'authorization_code' grant type, need to get the code
    // if code is not passed in explicitly, try extract it from responseUri
    if (!code && options.responseUri) {
      var u = url.parse(options.responseUri)
      code = qs.parse(u.query).code
    }
    if (!code) {
      return Promise.reject(new Error('Missing authorization code'))
    }
    formRequestData = {
      code: code,
      grant_type: grantType,
      redirect_uri: redirectUri
    }
  }

  var requestOptions = {
    url: uri,
    method: 'POST',
    form: formRequestData,
    json: true,
    auth: {
      user: self.client_id,
      pass: self.client_secret
    },
    agentOptions: self.agentOptions
  }
  if (self.proxy) {
    requestOptions.proxy = self.proxy
  }

  return new Promise(function (resolve, reject) {
    request(requestOptions)
      .then(function (data) {
        var verifyClaims = {
          access_claims: function (done) {
            AccessToken.verify(data.access_token, {
              key: self.jwks.keys[0],
              issuer: self.issuer
            }, function (err, claims) {
              if (err) { return done(err) }
              done(null, claims)
            })
          }
        }
        // when requesting a token using client credentials no ID information is
        // returned
        if (formRequestData.grant_type !== 'client_credentials') {
          verifyClaims.id_claims = function (done) {
            IDToken.verify(data.id_token, {
              iss: self.issuer,
              aud: self.client_id,
              key: self.jwks.keys[0]
            }, function (err, token) {
              if (err) { return done(err) }
              done(null, token.payload)
            })
          }
        }
        // verify tokens
        async.parallel(verifyClaims, function (err, result) {
          if (err) {
            return reject(err)
          }

          data.id_claims = result.id_claims
          data.access_claims = result.access_claims

          resolve(data)
        })
      })
      .catch(function (err) {
        reject(err)
      })
  })
}
AnvilConnect.prototype.token = token

/**
 * Retrieves user info / profile from the OIDC Provider (requires a valid access
 * token).
 * @method userInfo
 * @param options {Object} Options hashmap
 * @param options.token {String} Access token to exchange for userinfo. Required.
 * @return {Promise<Object>} Resolves to a userInfo hashmap object (or to an
 *   Error when the access token is missing)
 */
function userInfo (options) {
  var self = this
  options = options || {}
  var uri = self.configuration.userinfo_endpoint
  var agentOptions = self.agentOptions

  if (!options.token) {
    return Promise.reject(new Error('Missing access token'))
  }
  var requestOptions = {
    url: uri,
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + options.token
    },
    json: true,
    agentOptions: agentOptions
  }

  if (self.proxy) {
    requestOptions.proxy = self.proxy
  }
  // Access token is present
  return Promise.resolve()
    .then(function () {
      // return a request promise
      return request(requestOptions)
    })
}
AnvilConnect.prototype.userInfo = userInfo

/**
 * Verifies a given OIDC token
 * @method verify
 * @param token {String} JWT AccessToken for OpenID Connect (base64 encoded)
 * @param [options={}] {Object} Options hashmap
 * @param [options.issuer] {String} OIDC Provider/Issuer URL
 * @param [options.key] {Object} Issuer's public key for signatures (jwks.sig)
 * @param [options.client_id] {String}
 * @param [options.client_secret {String}
 * @param [options.scope] {String}
 * @throws {UnauthorizedError} HTTP 401 or 403 errors (invalid tokens etc)
 * @return {Promise}
 */
function verify (token, options) {
  options = options || {}
  options.issuer = options.issuer || this.issuer
  options.client_id = options.client_id || this.client_id
  options.client_secret = options.client_secret || this.client_secret
  options.scope = options.scope || this.scope
  options.key = options.key || this.jwks.sig

  return new Promise(function (resolve, reject) {
    AccessToken.verify(token, options, function (err, claims) {
      if (err) { return reject(err) }
      resolve(claims)
    })
  })
}
AnvilConnect.prototype.verify = verify

/**
 * Exports
 */
module.exports = AnvilConnect
