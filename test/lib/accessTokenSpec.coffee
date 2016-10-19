# Test dependencies
fs          = require 'fs'
cwd         = process.cwd()
path        = require 'path'
chai        = require 'chai'
sinon       = require 'sinon'
sinonChai   = require 'sinon-chai'
nock        = require 'nock'
expect      = chai.expect




# Assertions
chai.use sinonChai
chai.should()




# Code under test
AccessToken = require path.join cwd, 'lib/AccessToken'
JWT = require 'anvil-connect-jwt'
base64url = require 'base64url'
nowSeconds = require(path.join cwd, 'lib/time-utils').nowSeconds
pem2jwk = require('pem-jwk').pem2jwk




# Keypair
publicFile = path.join cwd, 'test/lib/keys/public.pem'
publicKey = fs.readFileSync(publicFile).toString('ascii')
privateFile = path.join cwd, 'test/lib/keys/private.pem'
privateKey = fs.readFileSync(privateFile).toString('ascii')
jwk = pem2jwk(publicKey)



describe 'Access Token', ->




  it 'should be a subclass of JWT', ->
    AccessToken.super.should.equal JWT




  describe 'header', ->

    it 'must not use "none" as "alg" value', ->
      expect(-> new AccessToken({}, { alg: 'none' })).to.throw Error

    it 'should not use "x5u", "x5c", "jku", or "jwk" header parameter fields', ->
      header =
        alg: 'RS256'
        x5u: 'x5u'
        x5c: 'x5c'
        jku: 'jku'
        jwk: 'jwk'
      payload =
        jti: 'random'
        iss: 'http://anvil.io'
        sub: 'uuid'
        aud: 'uuid'
        exp: Date.now()
        iat: Date.now()
        scope: 'openid profile'
      token = new AccessToken payload, header
      expect(token.header.x5u).to.be.undefined
      expect(token.header.x5c).to.be.undefined
      expect(token.header.jku).to.be.undefined
      expect(token.header.jwk).to.be.undefined




  describe 'claims', ->

    it 'should require "jti" property', ->
      AccessToken.registeredClaims.jti.required.should.be.true

    it 'should require "iss" Issuer Identifier', ->
      AccessToken.registeredClaims.iss.required.should.be.true

    it 'should require "iat" Issued time', ->
      AccessToken.registeredClaims.iat.required.should.be.true

    it 'should require "exp" Expiration time', ->
      AccessToken.registeredClaims.exp.required.should.be.true

    it 'should require "sub" Subject Identifier', ->
      AccessToken.registeredClaims.sub.required.should.be.true

    it 'should require "aud" Audience Identifier', ->
      AccessToken.registeredClaims.aud.required.should.be.true

    it 'should require "scope" property', ->
      AccessToken.registeredClaims.scope.required.should.be.true


  describe 'refresh', ->

    {err,token} = {}

    describe 'without refresh_token', ->

      it 'should provide an error', ->
        AccessToken.refresh null, {client_id:'fakeid', client_secret:'fakesecret'}, (err) ->
          err.should.be.instanceof Error

    describe 'without client_id', ->

      it 'should provide an error', ->
        AccessToken.refresh 'faketoken', {client_secret:'fakesecret'}, (err) ->
          err.should.be.instanceof Error

    describe 'without client_secret', ->

      it 'should provide an error', ->
        AccessToken.refresh 'faketoken', {client_id:'fakeid'}, (err) ->
          err.should.be.instanceof Error

    describe 'with all params and response ko', ->

      before (done) ->
        issuer = 'https://connect.anvil.io'

        options =
          issuer: issuer
          client_id: 'uuid2'
          client_secret: 'secret'

        headers =
          reqHeaders:
            'Content-Type': 'application/json'

        nock(issuer, headers)
        .post('/token', { refresh_token: 'faketoken', grant_type:'refresh_token'})
        .basicAuth({
          user: options.client_id
          pass: options.client_secret
        })
        .reply(400, {
          error: 'invalid_request'
        })

        AccessToken.refresh 'faketoken', options, (error, accesstoken) ->
          err   = error
          token = accesstoken
          done()

      after () ->
        nock.cleanAll()

      it 'should not provide an error', ->
        expect(err).to.be.ok

      it 'should provide a decoded token', ->
        expect(token).not.to.be.ok

    describe 'with all params and response ok', ->
      tokens =
        access_token: 'foo.bar.baz'
        refresh_token: 'foo'

      before (done) ->
        issuer = 'https://connect.anvil.io'

        options =
          issuer: issuer
          client_id: 'uuid2'
          client_secret: 'secret'

        headers =
          reqHeaders:
            'Content-Type': 'application/json'

        nock(issuer, headers)
        .post('/token', { refresh_token: 'faketoken', grant_type:'refresh_token'})
        .basicAuth({
          user: options.client_id
          pass: options.client_secret
        })
        .reply(200, tokens)

        AccessToken.refresh 'faketoken', options, (error, accesstoken) ->
          err   = error
          token = accesstoken
          done()

      after () ->
        nock.cleanAll()

      it 'should not provide an error', ->
        expect(err).to.not.be.ok

      it 'should provide a decoded token', ->
        token.should.eql tokens


  describe 'verify', ->


    {err,token} = {}


    describe 'with unverifiable JWT', ->

      it 'should provide an error', ->
        AccessToken.verify 'mal.formed.jwt', { key: jwk }, (err) ->
          err.should.be.instanceof Error


    describe 'with verifiable JWT and mismatching issuer', ->

      before (done) ->
        payload =
          jti: 'random'
          iss: 'https://WRONG.authorization.server'
          sub: 'uuid'
          aud: 'https://some.client.app'
          exp: Date.now()
          iat: Date.now()
          scope: 'openid profile'

        jwt = (new AccessToken payload).encode(privateKey)

        options =
          issuer: 'https://your.authorization.server'
          key: publicKey

        AccessToken.verify jwt, options, (error, accesstoken) ->
          err   = error
          token = accesstoken
          done()

      it 'should provide an error', ->
        expect(err).to.be.instanceof Error

      it 'should provide an error description', ->
        err.error_description.should.equal 'Mismatching issuer'

      it 'should not provide a decoded token', ->
        expect(token).to.be.undefined


    describe 'with verifiable JWT and mismatching audience', ->

      before (done) ->
        payload =
          jti: 'random'
          iss: 'http://your.authorization.server'
          sub: 'uuid'
          aud: 'https://WRONG.client.app'
          exp: Date.now()
          iat: Date.now()
          scope: 'openid profile'

        jwt = (new AccessToken payload).encode(privateKey)

        options =
          jti: 'random'
          issuer: payload.iss
          clients: ['https://client.app']
          key: jwk

        AccessToken.verify jwt, options, (error, accesstoken) ->
          err   = error
          token = accesstoken
          done()

      it 'should provide an error', ->
        expect(err).to.be.instanceof Error

      it 'should provide an error description', ->
        err.error_description.should.equal 'Mismatching audience'

      it 'should not provide a decoded token', ->
        expect(token).to.be.undefined


    describe 'with verifiable JWT and expired token', ->

      before (done) ->
        payload =
          jti: 'random'
          iss: 'https://your.authorization.server'
          sub: 'uuid'
          exp: nowSeconds(-1000)
          iat: Date.now()
          aud: 'https://your.client.app'
          scope: 'openid profile'

        jwt = (new AccessToken payload).encode(privateKey)

        options =
          issuer: payload.iss
          aud: payload.aud
          key: publicKey

        AccessToken.verify jwt, options, (error, accesstoken) ->
          err   = error
          token = accesstoken
          done()

      it 'should provide an error', ->
        expect(err).to.be.instanceof Error

      it 'should provide an error description', ->
        err.error_description.should.equal 'Expired access token'

      it 'should not provide a decoded token', ->
        expect(token).to.be.undefined


    describe 'with verifiable JWT and insufficient scope', ->

      before (done) ->
        payload =
          jti: 'random'
          iss: 'https://your.authorization.server'
          sub: 'uuid'
          exp: Date.now()
          iat: Date.now()
          aud: 'https://your.client.app'
          scope: 'openid profile'

        jwt = (new AccessToken payload).encode(privateKey)

        options =
          issuer: payload.iss
          aud: payload.aud
          key: publicKey
          scope: 'realm'

        AccessToken.verify jwt, options, (error, accesstoken) ->
          err   = error
          token = accesstoken
          done()

      it 'should provide an error', ->
        expect(err).to.be.instanceof Error

      it 'should provide an error description', ->
        err.error_description.should.equal 'Insufficient scope'

      it 'should not provide a decoded token', ->
        expect(token).to.be.undefined


    describe 'with verifiable JWT and valid payload', ->

      {payload,claims,err} = {}

      before (done) ->
        payload =
          jti: 'random'
          iss: 'https://your.authorization.server'
          sub: 'uuid'
          exp: Date.now()
          iat: Date.now()
          aud: 'https://your.client.app'
          scope: 'openid email profile'

        jwt = (new AccessToken payload).encode(privateKey)

        options =
          issuer: payload.iss
          aud: payload.aud
          key: publicKey
          scope: 'openid profile email'

        AccessToken.verify jwt, options, (error, accesstoken) ->
          err   = error
          token = accesstoken
          done()

      it 'should not provide an error', ->
        expect(err).not.to.be.ok

      it 'should provide a decoded token', ->
        token.jti.should.equal payload.jti
        token.iss.should.equal payload.iss
        token.sub.should.equal payload.sub
        token.exp.should.be.a.number
        token.iat.should.be.a.number
        token.aud.should.equal payload.aud
        token.scope.should.equal payload.scope


    describe 'with unverifiable random token', ->

      before (done) ->
        issuer = 'https://connect.anvil.io'

        claims =
          jti: 'random'
          iss: issuer
          sub: 'uuid'
          exp: Date.now()
          iat: Date.now()
          aud: 'https://your.client.app'
          scope: 'openid profile'

        options =
          issuer: issuer
          client_id: 'uuid2'
          client_secret: 'secret'

        headers =
          reqHeaders:
            'Content-Type': 'application/json'

        nock(issuer, headers)
          .post('/token/verify', { access_token: claims.jti })
          .basicAuth({
            user: options.client_id
            pass: options.client_secret
          })
          .reply(401, 'Unauthorized')

        AccessToken.verify claims.jti, options, (error, accesstoken) ->
          err   = error
          token = accesstoken
          done()

      after ->
        nock.cleanAll()

      it 'should provide an error', ->
        expect(err).to.be.instanceof Error

      it 'should provide an error description', ->
        err.message.should.equal 'Unauthorized'

      it 'should not provide a decoded token', ->
        expect(token).to.not.be.ok


    describe 'with verifiable random token and mismatching issuer', ->

      before (done) ->
        issuer = 'https://connect.anvil.io'

        claims =
          jti: 'random'
          iss: 'https://WRONG.anvil.io'
          sub: 'uuid'
          exp: Date.now()
          iat: Date.now()
          aud: 'https://your.client.app'
          scope: 'openid profile'

        options =
          issuer: issuer
          client_id: 'uuid2'
          client_secret: 'secret'

        headers =
          reqHeaders:
            'Content-Type': 'application/json'

        nock(issuer, headers)
          .post('/token/verify', { access_token: claims.jti })
          .basicAuth({
            user: options.client_id
            pass: options.client_secret
          })
          .reply(200, claims)

        AccessToken.verify claims.jti, options, (error, accesstoken) ->
          err   = error
          token = accesstoken
          done()

      after ->
        nock.cleanAll()

      it 'should provide an error', ->
        expect(err).to.be.instanceof Error

      it 'should provide an error description', ->
        err.error_description.should.equal 'Mismatching issuer'

      it 'should not provide a decoded token', ->
        expect(token).to.not.be.ok


    describe 'with verifiable random token and mismatching audience', ->

      before (done) ->
        issuer = 'https://connect.anvil.io'

        claims =
          jti: 'random'
          iss: issuer
          sub: 'uuid'
          exp: Date.now()
          iat: Date.now()
          aud: 'https://your.client.app'
          scope: 'openid profile'

        options =
          issuer: issuer
          client_id: 'uuid2'
          client_secret: 'secret'
          clients: 'https://not.client.app'

        headers =
          reqHeaders:
            'Content-Type': 'application/json'

        nock(issuer, headers)
          .post('/token/verify', { access_token: claims.jti })
          .basicAuth({
            user: options.client_id
            pass: options.client_secret
          })
          .reply(200, claims)

        AccessToken.verify claims.jti, options, (error, accesstoken) ->
          err   = error
          token = accesstoken
          done()

      after ->
        nock.cleanAll()

      it 'should provide an error', ->
        expect(err).to.be.instanceof Error

      it 'should provide an error description', ->
        err.error_description.should.equal 'Mismatching audience'

      it 'should not provide a decoded token', ->
        expect(token).to.not.be.ok


    describe 'with verifiable random token and expired token', ->

      before (done) ->
        issuer = 'https://connect.anvil.io'

        claims =
          jti: 'random'
          iss: issuer
          sub: 'uuid'
          exp: nowSeconds(-1000)
          iat: Date.now()
          aud: 'https://your.client.app'
          scope: 'openid profile'

        options =
          issuer: issuer
          client_id: 'uuid2'
          client_secret: 'secret'

        headers =
          reqHeaders:
            'Content-Type': 'application/json'

        nock(issuer, headers)
          .post('/token/verify', { access_token: claims.jti })
          .basicAuth({
            user: options.client_id
            pass: options.client_secret
          })
          .reply(200, claims)

        AccessToken.verify claims.jti, options, (error, accesstoken) ->
          err   = error
          token = accesstoken
          done()

      after ->
        nock.cleanAll()

      it 'should provide an error', ->
        expect(err).to.be.instanceof Error

      it 'should provide an error description', ->
        err.error_description.should.equal 'Expired access token'

      it 'should not provide a decoded token', ->
        expect(token).to.not.be.ok


    describe 'with verifiable random token and insufficient scope', ->

      before (done) ->
        issuer = 'https://connect.anvil.io'

        claims =
          jti: 'random'
          iss: issuer
          sub: 'uuid'
          exp: Date.now()
          iat: Date.now()
          aud: 'https://your.client.app'
          scope: 'openid profile'

        options =
          issuer: issuer
          client_id: 'uuid2'
          client_secret: 'secret'
          scope: 'realm'

        headers =
          reqHeaders:
            'Content-Type': 'application/json'

        nock(issuer, headers)
          .post('/token/verify', { access_token: claims.jti })
          .basicAuth({
            user: options.client_id
            pass: options.client_secret
          })
          .reply(200, claims)

        AccessToken.verify claims.jti, options, (error, accesstoken) ->
          err   = error
          token = accesstoken
          done()

      after ->
        nock.cleanAll()

      it 'should provide an error', ->
        expect(err).to.be.instanceof Error

      it 'should provide an error description', ->
        err.error_description.should.equal 'Insufficient scope'

      it 'should not provide a decoded token', ->
        expect(token).to.not.be.ok


    describe 'with verifiable random token and valid payload', ->

      {claims} = {}

      before (done) ->
        issuer = 'https://connect.anvil.io'

        claims =
          jti: 'random'
          iss: issuer
          sub: 'uuid'
          exp: Date.now()
          iat: Date.now()
          aud: 'https://your.client.app'
          scope: 'openid profile'

        options =
          issuer: issuer
          client_id: 'uuid2'
          client_secret: 'secret'

        headers =
          reqHeaders:
            'Content-Type': 'application/json'

        nock(issuer, headers)
          .post('/token/verify', { access_token: claims.jti })
          .basicAuth({
            user: options.client_id
            pass: options.client_secret
          })
          .reply(200, claims)

        AccessToken.verify claims.jti, options, (error, accesstoken) ->
          err   = error
          token = accesstoken
          done()

      it 'should not provide an error', ->
        expect(err).to.not.be.ok

      it 'should provide a decoded token', ->
        token.should.eql claims




