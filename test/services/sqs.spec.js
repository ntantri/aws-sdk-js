var sqsModel = require('../../apis/sqs-2012-11-05.min.json');
var isJsonProtocol = sqsModel.metadata.protocol === 'json';

(function() {
  var AWS, helpers;

  helpers = require('../helpers');

  AWS = helpers.AWS;

  describe('AWS.SQS', function() {
    var sqs = null;
    beforeEach(function() {
      return sqs = new AWS.SQS({
        params: {
          QueueUrl: 'http://url'
        }
      });
    });
    var checksumValidate = function(operation, input, response, shouldPass, cb) {
      helpers.mockHttpResponse(200, {}, response);
      return sqs[operation](input).send(function(err, data) {
        if (shouldPass) {
          if (err !== null) {
            throw err;
          }
          expect(err).to.equal(null);
        } else {
          expect(err).not.to.equal(null);
        }
        return cb(err, data);
      });
    };
    describe('buildEndpoint', function() {
      return it('should detect correct region from QueueUrl', function() {
        var req;
        sqs = new AWS.SQS({
          computeChecksums: false,
          params: {
            QueueUrl: 'http://sqs.region-1.amazonaws.com/queue'
          }
        });
        helpers.mockHttpResponse(200, {}, '');
        req = sqs.sendMessage({
          MessageBody: 'foo'
        });
        req.build();
        return expect(req.httpRequest.region).to.equal('region-1');
      });
    });
    describe('sendMessage', function() {
      var input, md5, payload;
      input = {
        MessageBody: 'foo'
      };
      md5 = 'acbd18db4cc2f85cedef654fccc4a4d8';
      payload = function(md5) {
        if (isJsonProtocol) {
          return JSON.stringify({
            MD5OfMessageBody: md5,
            MessageId: 'MSGID',
          }, null, 2);
        }
        return '<SendMessageResponse><SendMessageResult>\n  <MD5OfMessageBody>' + md5 + '</MD5OfMessageBody>\n  <MessageId>MSGID</MessageId>\n</SendMessageResult></SendMessageResponse>';
      };
      it('correctly validates MD5 of message input', function(done) {
        return checksumValidate('sendMessage', input, payload(md5), true, function(err, data) {
          expect(data.MD5OfMessageBody).to.equal(md5);
          return done();
        });
      });
      it('raises InvalidChecksum if MD5 does not match message input', function(done) {
        return checksumValidate('sendMessage', input, payload('000'), false, function(err) {
          expect(err.message).to.contain('Got "000", expecting "acbd18db4cc2f85cedef654fccc4a4d8"');
          expect(err.messageIds).to.eql(['MSGID']);
          return done();
        });
      });
      return it('ignores checksum errors if computeChecksums is false', function(done) {
        sqs.config.computeChecksums = false;
        return checksumValidate('sendMessage', input, payload('000'), true, function() {
          return done();
        });
      });
    });
    describe('sendMessageBatch', function() {
      var input, md5bar, md5foo, payload;
      input = {
        Entries: [
          {
            Id: 'a',
            MessageBody: 'foo'
          }, {
            Id: 'b',
            MessageBody: 'bar'
          }, {
            Id: 'c',
            MessageBody: 'bar'
          }
        ]
      };
      md5foo = 'acbd18db4cc2f85cedef654fccc4a4d8';
      md5bar = '37b51d194a7513e45b56f6524f2d51f2';
      payload = function(md5a, md5b, md5c) {
        if (isJsonProtocol) {
          return JSON.stringify({
            Successful: [
              {
                Id: 'a',
                MessageId: 'MSGID1',
                MD5OfMessageBody: md5a
              },
              {
                Id: 'b',
                MessageId: 'MSGID2',
                MD5OfMessageBody: md5b
              },
              {
                Id: 'c',
                MessageId: 'MSGID3',
                MD5OfMessageBody: md5c
              }
            ]
          }, null, 2);
        }
        return '<SendMessageBatchResponse><SendMessageBatchResult>\n  <SendMessageBatchResultEntry>\n    <Id>a</Id>\n    <MessageId>MSGID1</MessageId>\n    <MD5OfMessageBody>' + md5a + '</MD5OfMessageBody>\n  </SendMessageBatchResultEntry>\n  <SendMessageBatchResultEntry>\n    <Id>b</Id>\n    <MessageId>MSGID2</MessageId>\n    <MD5OfMessageBody>' + md5b + '</MD5OfMessageBody>\n  </SendMessageBatchResultEntry>\n  <SendMessageBatchResultEntry>\n    <Id>c</Id>\n    <MessageId>MSGID3</MessageId>\n    <MD5OfMessageBody>' + md5c + '</MD5OfMessageBody>\n  </SendMessageBatchResultEntry>\n</SendMessageBatchResult></SendMessageBatchResponse>';
      };
      it('correctly validates MD5 of operation', function(done) {
        var output;
        output = payload(md5foo, md5bar, md5bar);
        return checksumValidate('sendMessageBatch', input, output, true, function(err, data) {
          expect(data.Successful[0].MD5OfMessageBody).to.equal(md5foo);
          expect(data.Successful[1].MD5OfMessageBody).to.equal(md5bar);
          expect(data.Successful[2].MD5OfMessageBody).to.equal(md5bar);
          return done();
        });
      });
      it('raises InvalidChecksum with relevent message IDs', function(done) {
        var output;
        output = payload('000', md5bar, '000');
        return checksumValidate('sendMessageBatch', input, output, false, function(err, data) {
          expect(err.message).to.contain('Invalid messages: a, c');
          expect(err.messageIds).to.eql(['MSGID1', 'MSGID3']);
          return done();
        });
      });
      return it('ignores checksum errors if computeChecksums is false', function(done) {
        var output;
        output = payload(md5foo, '000', md5bar);
        sqs.config.computeChecksums = false;
        return checksumValidate('sendMessageBatch', input, output, true, function() {
          return done();
        });
      });
    });
    return describe('receiveMessage', function() {
      var md5, payload;
      md5 = 'acbd18db4cc2f85cedef654fccc4a4d8';
      payload = function(body, md5, id) {
        if (isJsonProtocol) {
          return JSON.stringify({
            Messages: [
              {
                Body: body,
                MD5OfBody: md5,
                MessageId: id
              }
            ]
          }, null, 2);
        }
        return '<ReceiveMessageResponse><ReceiveMessageResult><Message>\n  <Body>' + body + '</Body>\n  <MD5OfBody>' + md5 + '</MD5OfBody>\n  <MessageId>' + id + '</MessageId>\n</Message></ReceiveMessageResult></ReceiveMessageResponse>';
      };
      it('correctly validates MD5 of operation', function(done) {
        var output;
        output = payload('foo', md5, 'MSGID');
        return checksumValidate('receiveMessage', {}, output, true, function(err, data) {
          expect(data.Messages[0].MD5OfBody).to.equal(md5);
          return done();
        });
      });
      it('raises InvalidChecksum with relevent message IDs', function(done) {
        var output;
        output = payload('foo', '000', 'MSGID');
        return checksumValidate('receiveMessage', {}, output, false, function(err, data) {
          expect(err.message).to.contain('Invalid messages: MSGID');
          expect(err.messageIds).to.eql(['MSGID']);
          return done();
        });
      });
      return it('ignores checksum errors if computeChecksums is false', function(done) {
        var output;
        output = payload('foo', '000', 'MSGID');
        sqs.config.computeChecksums = false;
        return checksumValidate('receiveMessage', {}, output, true, function(err, data) {
          expect(data.Messages[0].MD5OfBody).not.to.equal(md5);
          return done();
        });
      });
    });
  });

}).call(this);
