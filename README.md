# Anvil Connect client for Node.js 
[![NPM Version](https://img.shields.io/npm/v/anvil-connect-nodejs.svg?style=flat)](https://npm.im/anvil-connect-nodejs)
[![Build Status](https://travis-ci.org/anvilresearch/connect-nodejs.svg?branch=master)](https://travis-ci.org/anvilresearch/connect-nodejs)

[Anvil Connect][connect] is a modern authorization server built to authenticate 
your users and protect your APIs. It's based on [OAuth 2.0][oauth2] and 
[OpenID Connect][oidc]. 

This library is a low level OpenID Connect and Anvil Connect API client. 
Previous versions included Express-specific functions and 
middleware. These higher-level functions are being split out into a 
[separate library][connect-express].

[oauth2]: http://tools.ietf.org/html/rfc6749
[oidc]: http://openid.net/connect/
[connect]: https://github.com/anvilresearch/connect
[connect-nodejs]: https://github.com/anvilresearch/connect-nodejs
[connect-express]: https://github.com/anvilresearch/connect-express

### Install

```bash
$ npm install anvil-connect-nodejs --save
```

### Configure

Before performing any other operations (such as verifying or refreshing OIDC
tokens, or accessing the AnvilConnect-specific API (such as creating users),
an OIDC client needs to be configured and registered with the server (OIDC
Provider, OP for short).

#### new AnvilConnect(config)

```javascript
var AnvilConnectClient = require('anvil-connect-nodejs');

// If the client has been pre-registered, pass the credentials to constructor
var client = new AnvilConnectClient({
  issuer: 'https://connect.example.com',
  client_id: 'CLIENT_ID',
  client_secret: 'CLIENT_SECRET',
  redirect_uri: 'REDIRECT_URI',
  scope: 'realm'
})
client.initProvider()
  .then(function () {
    // Ready to verify() tokens, refresh(), etc
  })

// If the client has not been registered, use OIDC dynamic registration
var client = new AnvilConnectClient({ issuer: 'https://connect.example.com' })
client.initProvider()
  .then(function () {
    // Provider config loaded (.discover() and .getJWKs() called)
    
    // Ready to register()
    return client.register({
      // ... see below for registration options
    })
  })
  .then(function () {
    // Client is now registered. Ready to verify() tokens, refresh(), etc
  })
  .catch(function (err) {
    // as always, don't forget error handling
  })
```

**options**

* `issuer` – REQUIRED uri of your OpenID Connect provider
* `client_id` – OPTIONAL client identifier issued by OIDC provider during
  registration
* `client_secret` – OPTIONAL confidential value issued by OIDC provider during 
  registration
* `redirect_uri` – OPTIONAL uri users will be redirected back to after 
  authenticating with the issuer
* `scope` – OPTIONAL array of strings, or space delimited string value 
  containing scopes to be included in authorization requests. 
  Defaults to `openid profile`


### OpenID Connect

#### client.discover()

Returns a promise providing [OpenID Metadata][oidc-meta] retrieved from the 
`.well-known/openid-configuration` endpoint for the configured issuer. Sets the
response data as `client.configuration`.

[oidc-meta]: http://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata

**example**

```javascript
client.discover()
  .then(function (openidMetadata) {
    // client.configuration === openidMetadata
  })
  .catch(function (error) {
    // ...
  })
```

#### client.getJWKs()

Returns a promise providing the JWK set published by the configured issuer. 
Depends on a prior call to `client.discover()`.

**example**

```javascript
client.getJWKs()
  .then(function (jwks) {
    // client.jwks === jwks
  })
  .catch(function (error) {
    // ...
  })
```

#### client.register(registration)

Dynamically registers a new client with the configured issuer and returns a 
promise for the new client registration. You can learn more about [dynamic 
registration for Anvil Connect][dynamic-registration] in the docs. Depends on a
prior call to `client.discover()`.

[dynamic-registration]: https://github.com/anvilresearch/connect-docs/blob/master/clients.md#dynamic-registration

**example**

```javascript
var options = {
  client_name: 'Antisocial Network',
  client_uri: 'https://app.example.com',
  logo_uri: 'https://app.example.com/assets/logo.png',
  response_types: ['code'],
  grant_types: ['authorization_code', 'refresh_token'],
  default_max_age: 86400, // one day in seconds
  redirect_uris: ['https://app.example.com/callback.html', 'https://app.example.com/other.html'],
  post_logout_redirect_uris: ['https://app.example.com']
}
client.register(options)
  .then(function (data) {
    // After the register request resolves
    // client.client_id and .client_secret are initialized
    // and the rest of the returned data is set to client.registration
  })
```

#### client.authorizationUri([endpoint|options])

Accepts a string specifying a non-default endpoint or an options object and 
returns an authorization URI. Depends on a prior call to `client.discover()` and
`client_id` being configured.

**options**

* All options accepted by `client.authorizationParams()`.
* `endpoint` – This value is used for the path in the returned URI. Defaults to `authorize`. 

**example**

```javascript
client.authorizationUri()
// 'https://connect.example.com/authorize?response_type=code&client_id=CLIENT_ID&redirect_uri=REDIRECT_URI&scope=openid%20profile%20more'

client.authorizationUri('signin')
// 'https://connect.example.com/signin?response_type=code&client_id=CLIENT_ID&redirect_uri=REDIRECT_URI&scope=openid%20profile%20more'

client.authorizationUri({
  endpoint: 'connect/google',
  response_type: 'code id_token token',
  redirect_uri: 'OTHER_REDIRECT_URI',
  scope: 'openid profile extra'
})
// 'https://connect.example.com/connect/google?response_type=code%20id_token%20token&client_id=CLIENT_ID&redirect_uri=OTHER_REDIRECT_URI&scope=openid%20profile%20extra'
```


#### client.authorizationParams(options)

Accepts an options object and returns an object containing authorization params
including default values. Depends on `client_id` being configured.

*Note:* This is a low-level function used by `authorizationUri()`,
documented to list its parameters (which are passed through to
`authorizationParams()`). It's unlikely that your code will be invoking it
directly.

**options**

* `response_type` – defaults to `code`
* `redirect_uri` – defaults to the `redirect_uri` configured for this client
* `scope` – defaults to the scope configured for this client
* `state`
* `response_mode`
* `nonce`
* `display`
* `prompt`
* `max_age`
* `ui_locales`
* `id_token_hint`
* `login_hint`
* `acr_values`
* `email`
* `password`
* `provider`

#### client.token(options)

Given an authorization code is provided as the `code` option, this method will 
exchange the auth code for a set of token credentials, then verify the 
signatures and decode the payloads. Depends on `client_id` and `client_secret`
being configured, and prior calls to `client.discover()` and `client.getJWKs()`.

**options**

 * `code` – value obtained from a successful authorization request with `code` 
   in the `response_types` request param

**example**

```javascript
client.token({ code: 'AUTHORIZATION_CODE' })
```

#### client.refresh(options)

Given an refresh_token is provided as the `refresh_token` option, this method 
will exchange the refresh_token for a set of token credentials, then verify the
signatures. Depends on `client_id` and `client_secret` being configured, and 
prior calls to `client.discover()` and `client.getJWKs()`.

**options**

* `refresh_token` – value obtained from a successful authorization request with
  `token` in the `response_types` request param

**example**

```javascript
client.refresh({ refresh_token: 'REFRESH_TOKEN' })
```

#### client.userInfo(options)

Get user info from the issuer.

**options**

* `token` – access token

**example**

```javascript
client.userInfo({ token: 'ACCESS_TOKEN' })
```

#### client.verify(token, options)

### Anvil Connect Admin API

Anvil Connect provides a backend admin-only API (outside of the OIDC specs),
for managing clients, users and so on.

Note: All of these operations require an access token passed in `options.token`.
You can get this token either via an admin user (with an `authority` role
assigned to them) login, OR via a Client Credentials Grant request
(see `client.getClientAccessToken()` docs in `../index.js`).
Example Usage:

 
```
client.getClientAccessToken()
  .then(function (accessToken) {
    var options = { token: accessToken }
    // Once you have the access token you can
    //   call client.users.update(), create(), delete(), etc
    return client.users.create(userData, options)
  })
```

#### Clients

#### client.clients.list()
#### client.clients.get(id)
#### client.clients.create(data)
#### client.clients.update(id, data)
#### client.clients.delete(id)

#### Roles

#### client.roles.list()
#### client.roles.get(id)
#### client.roles.create(data)
#### client.roles.update(id, data)
#### client.roles.delete(id)

#### Scopes

#### client.scopes.list()
#### client.scopes.get(id)
#### client.scopes.create(data)
#### client.scopes.update(id, data)
#### client.scopes.delete(id)

#### Users

#### client.users.list()
#### client.users.get(id)
#### client.users.getByEmail(email)
#### client.users.create(data)
#### client.users.update(id, data)
#### client.users.updatePassword(id, password)
#### client.users.delete(id)

### Example

```javascript
var AnvilConnectClient = require('anvil-connect-nodejs');

// Assumes a preregistered client (if not, call register() after initProvider())
var client = new AnvilConnectClient({
  issuer: 'https://connect.example.com',
  client_id: 'CLIENT_ID',
  client_secret: 'CLIENT_SECRET',
  redirect_uri: 'REDIRECT_URI'
}) 

// Initialize the provider config (endpoints and public keys)
client.initProvider()
  .then(function () {
    // At this point, provider config and public keys are loaded and cached
    console.log(client.configuration)
    console.log(jwks)
    
    // Now, build an authorization url
    return client.authorizationUri()
  })
  .then(function (url) {
    console.log(url)

    // handle an authorization response
    // this verifies the signatures on tokens received from the authorization server
    return client.token({ code: 'AUTHORIZATION_CODE' })
  })
  .then(function (tokens) {
    // a successful call to tokens() gives us id_token, access_token, 
    // refresh_token, expiration, and the decoded payloads of the JWTs
    console.log(tokens)

    // get userinfo
    return client.userInfo({ token: tokens.access_token })
  })
  .then(function (userInfo) {
    console.log(userInfo)

    // verify an access token received by an API service
    return client.verify(JWT, { scope: 'research' })
  })
```
