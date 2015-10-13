/**
 * Module dependencies
 */

var qs = require('qs')
var url = require('url')
var async = require('async')
var request = require('request-promise')
var clients = require('./rest/clients')
var roles = require('./rest/roles')
var roleScopes = require('./rest/roleScopes')
var scopes = require('./rest/scopes')
var users = require('./rest/users')
var userRoles = require('./rest/userRoles')
var IDToken = require('./lib/IDToken')
var AccessToken = require('./lib/AccessToken')
var UnauthorizedError = require('./errors/UnauthorizedError')

/**
 * Constructor
 */

function AnvilConnect (options) {
  options = options || {}

  // assign required options
  this.issuer = options.issuer
  this.client_id = options.client_id
  this.client_secret = options.client_secret
  this.redirect_uri = options.redirect_uri
  this.agentOptions = options.agentOptions

  this.clients = {
    list: clients.list.bind(this),
    get: clients.get.bind(this),
    create: clients.create.bind(this),
    update: clients.update.bind(this),
    delete: clients.delete.bind(this)
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
    create: users.create.bind(this),
    update: users.update.bind(this),
    delete: users.delete.bind(this),
    roles: {
      list: userRoles.listRoles.bind(this),
      add: userRoles.addRole.bind(this),
      delete: userRoles.deleteRole.bind(this)
    }
  }

  // add scope to defaults
  var defaultScope = ['openid', 'profile']
  if (typeof options.scope === 'string') {
    this.scope = defaultScope.concat(options.scope.split(' ')).join(' ')
  } else if (Array.isArray(options.scope)) {
    this.scope = defaultScope.concat(options.scope).join(' ')
  } else {
    this.scope = defaultScope.join(' ')
  }
}

/**
 * Errors
 */

AnvilConnect.UnauthorizedError = UnauthorizedError

/**
 * Configure
 *
 * Requests OIDC configuration from the AnvilConnect instance's provider.
 */

function discover () {
  var self = this

  // construct the uri
  var uri = url.parse(this.issuer)
  uri.pathname = '.well-known/openid-configuration'
  uri = url.format(uri)

  // return a promise
  return new Promise(function (resolve, reject) {
    request({
      url: uri,
      method: 'GET',
      json: true,
      agentOptions: self.agentOptions
    })
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
 * JWK set
 *
 * Requests JSON Web Key set from configured provider
 */

function getJWKs () {
  var self = this
  var uri = this.configuration.jwks_uri

  return new Promise(function (resolve, reject) {
    request({
      url: uri,
      method: 'GET',
      json: true,
      agentOptions: self.agentOptions
    })
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
 * Register client
 *
 * Right now this only works with dynamic registration. Anvil Connect server instances
 * that are configured with `token` or `scoped` for `client_registration` don't yet
 * work.
 */

function register (registration) {
  var self = this
  var uri = this.configuration.registration_endpoint
  var token = this.tokens && this.tokens.access_token

  return new Promise(function (resolve, reject) {
    request({
      url: uri,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token
      },
      json: registration,
      agentOptions: self.agentOptions
    })
    .then(function (data) {
      self.client_id = data.client_id
      self.client_secret = data.client_secret
      self.registration = data
      resolve(data)
    })
    .catch(function (err) {
      reject(err)
    })
  })
}

AnvilConnect.prototype.register = register

/**
 * Authorization URI
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
 * Authorization Params
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
 * Token
 */

function token (options) {
  options = options || {}

  var self = this
  var uri = this.configuration.token_endpoint
  var code = options.code

  // get the authorization code
  if (!code && options.responseUri) {
    var u = url.parse(options.responseUri)
    code = qs.parse(u.query).code
  }

  return new Promise(function (resolve, reject) {
    if (!code) {
      return reject(new Error('Missing authorization code'))
    }

    request({
      url: uri,
      method: 'POST',
      form: {
        grant_type: options.grant_type || 'authorization_code',
        code: code,
        redirect_uri: options.redirect_uri || self.redirect_uri
      },
      json: true,
      auth: {
        user: self.client_id,
        pass: self.client_secret
      },
      agentOptions: self.agentOptions
    })
    .then(function (data) {
      // verify tokens
      async.parallel({
        id_claims: function (done) {
          IDToken.verify(data.id_token, {
            iss: self.issuer,
            aud: self.client_id,
            key: self.jwks.keys[0]
          }, function (err, token) {
            if (err) { return done(err) }
            done(null, token.payload)
          })
        },

        access_claims: function (done) {
          AccessToken.verify(data.access_token, {
            key: self.jwks.keys[0],
            issuer: self.issuer
          }, function (err, claims) {
            if (err) { return done(err) }
            done(null, claims)
          })
        }
      }, function (err, result) {
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
 * User Info
 */

function userInfo (options) {
  options = options || {}

  var uri = this.configuration.userinfo_endpoint
  var self = this

  return new Promise(function (resolve, reject) {
    if (!options.token) {
      return reject(new Error('Missing access token'))
    }

    request({
      url: uri,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + options.token
      },
      json: true,
      agentOptions: self.agentOptions
    })
    .then(function (data) {
      resolve(data)
    })
    .catch(function (err) {
      reject(err)
    })
  })
}

AnvilConnect.prototype.userInfo = userInfo

/**
 * Verify Access Token
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
