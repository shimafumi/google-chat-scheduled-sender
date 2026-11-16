function execute() {
  const LOCALE = 'Asia/Tokyo'
  const SCHEDULED_MESSAGES_SHEET_NAME = 'Scheduled messages'
  const NONBUSINESS_DAYS_SHEET_NAME = 'Non business days'
  const FIRST_ROW_OF_SCHEDULED_MESSAGES = 1
  const FIRST_ROW_OF_BUSINESSDAYS = 1
  const TRUE_STRING = 'true'
  const SPREADSHEET = SpreadsheetApp.getActive()
  const SCHEDULED_MESSAGES_SHEET_URL = SPREADSHEET.getUrl()
    + '#gid=' + SPREADSHEET.getSheetByName(SCHEDULED_MESSAGES_SHEET_NAME).getSheetId()
  const MESSAGE_FOOTER = `This message is posted by <a href="${SCHEDULED_MESSAGES_SHEET_URL}">Google chat scheduled sender</a>.`

  const isBusinessDay = function (date, nonBusinessDays) {
    //fixme:to be parameterized
    if (date.getDay() === 0 || date.getDay() === 6) return false

    for (let i = 0; i < nonBusinessDays.length; i++) {
      if (Utilities.formatDate(nonBusinessDays[i].date, LOCALE, 'yyyy/MM/dd')
        === Utilities.formatDate(date, LOCALE, 'yyyy/MM/dd')) return false;
    }
    return true
  }

  const isScheduledDate = function (date, scheduledMessage) {

    const equal = function (a, b) {
      if (!Array.isArray(a)) return false;
      if (!Array.isArray(b)) return false;
      if (a.length != b.length) return false;
      for (var i = 0, n = a.length; i < n; ++i) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    }

    if (!equal(scheduledMessage.minute, ['*'])
      && !scheduledMessage.minute.includes(Utilities.formatDate(date, LOCALE, 'm')))
      return false
    if (!equal(scheduledMessage.hour, ['*'])
      && !scheduledMessage.hour.includes(Utilities.formatDate(date, LOCALE, 'H')))
      return false
    if (!equal(scheduledMessage.day, ['*'])
      && !scheduledMessage.day.includes(Utilities.formatDate(date, LOCALE, 'd')))
      return false
    if (!equal(scheduledMessage.month, ['*'])
      && !scheduledMessage.month.includes(Utilities.formatDate(date, LOCALE, 'M')))
      return false
    if (!equal(scheduledMessage.dayOfWeek, ['*'])
      && !scheduledMessage.dayOfWeek.includes(Utilities.formatDate(date, LOCALE, 'u')))
      return false
    return true
  }


  const isSendable = function (scheduledMessage, date, nonBusinessDays) {

    const isSkippedBeforeThePreviousDay = function (scheduledMessage, date, nonBusinessDays) {
      const oneDayBefore = new Date(date.getTime());
      oneDayBefore.setDate(oneDayBefore.getDate() - 1)

      if (isBusinessDay(oneDayBefore, nonBusinessDays)) {
        return false
      }

      if (isScheduledDate(oneDayBefore, scheduledMessage)) {
        return true
      }

      return isSkippedBeforeThePreviousDay(scheduledMessage, oneDayBefore, nonBusinessDays)
    }

    const isSkippedAfterTheNextDay = function (scheduledMessage, date, nonBusinessDays) {
      const oneDayAfter = new Date(date.getTime());
      oneDayAfter.setDate(oneDayAfter.getDate() + 1)

      if (isBusinessDay(oneDayAfter, nonBusinessDays)) {
        return false
      }

      if (isScheduledDate(oneDayAfter, scheduledMessage)) {
        return true
      }

      return isSkippedAfterTheNextDay(scheduledMessage, oneDayAfter, nonBusinessDays)
    }

    if (scheduledMessage.skipOnNonBusinessDay.toLowerCase() === TRUE_STRING) {

      if (!isBusinessDay(date, nonBusinessDays)) return false

      if (scheduledMessage.sendOnTheNextBusinessDay.toLowerCase() === TRUE_STRING
        && isSkippedBeforeThePreviousDay(scheduledMessage, date, nonBusinessDays)) {
        Logger.log('Scheduled message[#%s] will be sent on %s because of "send on the next business day" option.'
          , scheduledMessage.id.toString()
          , Utilities.formatDate(date, LOCALE, 'yyyy/MM/dd').toString())
        return true
      }

      if (scheduledMessage.sendOnThePreviousBusinessDay.toLowerCase() === TRUE_STRING
        && isSkippedAfterTheNextDay(scheduledMessage, date, nonBusinessDays)) {
        Logger.log('Scheduled message[#%s] will be sent on %s because of "send on the previous business day" option.'
          , scheduledMessage.id.toString()
          , Utilities.formatDate(date, LOCALE, 'yyyy/MM/dd').toString())
        return true
      }
    }

    return isScheduledDate(date, scheduledMessage)
  }

  const now = new Date();

  const scheduledMessages = (function () {
    const values = SpreadsheetApp.getActive().getSheetByName(SCHEDULED_MESSAGES_SHEET_NAME).getDataRange().getValues();
    const scheduledMessages = []
    for (let i = FIRST_ROW_OF_SCHEDULED_MESSAGES; i < values.length; i++) {
      let col = 0;
      scheduledMessages.push({
        'id': String(values[i][col++]).split(','),
        'minute': String(values[i][col++]).split(','),
        'hour': String(values[i][col++]).split(','),
        'day': String(values[i][col++]).split(','),
        'month': String(values[i][col++]).split(','),
        'dayOfWeek': String(values[i][col++]).split(','),
        'skipOnNonBusinessDay': String(values[i][col++]),
        'sendOnThePreviousBusinessDay': String(values[i][col++]),
        'sendOnTheNextBusinessDay': String(values[i][col++]),
        'message': String(values[i][col++]),
        'webhookUrl': String(values[i][col++]),
        'threadUrl': String(values[i][col++]),
        'toString': function () {
          return 'id: ' + this.id
            + ', minute: ' + this.minute
            + ', hour: ' + this.hour
            + ', day: ' + this.day
            + ', month: ' + this.month
            + ', dayOfWeek: ' + this.dayOfWeek
            + ', skipOnNonBusinessDay: ' + this.skipOnNonBusinessDay
            + ', sendOnThePreviousBusinessDay: ' + this.sendOnThePreviousBusinessDay
            + ', sendOnTheNextBusinessDay: ' + this.sendOnTheNextBusinessDay
            + ', message: ' + this.message
            + ', webhookUrl: ' + this.webhookUrl
            + ', threadUrl: ' + this.threadUrl
        }
      })
    }
    return scheduledMessages
  })();

  const nonBusinessDays = (function () {
    const values = SpreadsheetApp.getActive().getSheetByName(NONBUSINESS_DAYS_SHEET_NAME).getDataRange().getValues();
    const nonBusinessDays = []
    for (let i = FIRST_ROW_OF_BUSINESSDAYS; i < values.length; i++) {
      let col = 0;
      nonBusinessDays.push({
        'date': new Date(values[i][col++])
      })
    }
    return nonBusinessDays
  })();

  for (let i = 0; i < scheduledMessages.length; i++) {
    if (isSendable(scheduledMessages[i], now, nonBusinessDays)) {
      if (!scheduledMessages[i].threadUrl) {

        const payload = {
          'cardsV2': [{
            "cardId": "reminder",
            "card": {
              'header': {
                'title': 'Reminder',
                "imageUrl": "https://fonts.gstatic.com/s/e/notoemoji/14.0/23f0/512.png=s32"
              },
              'sections': [{
                'widgets': [
                  { 'textParagraph': { 'text': `${scheduledMessages[i].message}` } },
                  { 'divider': {} },
                  { 'textParagraph': { 'text': `${MESSAGE_FOOTER}` } }
                ]
              }]
            }
          }]
        };

        GoogleChatMessageSender.send(
          scheduledMessages[i].webhookUrl,
          payload);
      } else {

        const payload = {
          'cardsV2': [{
            "cardId": "reminder",
            "card": {
              'header': {
                'title': 'Reminder',
                "imageUrl": "https://fonts.gstatic.com/s/e/notoemoji/14.0/23f0/512.png=s32"
              },
              'sections': [{
                'widgets': [
                  { 'textParagraph': { 'text': `${scheduledMessages[i].message}` } },
                  { 'divider': {} },
                  { 'textParagraph': { 'text': `${MESSAGE_FOOTER}` } }
                ]
              }]
            }
          }],
          'thread': {
            'name': `${GoogleChatMessageSender.buildThreadName(scheduledMessages[i].threadUrl)}`
          }
        };
        GoogleChatMessageSender.send(
          scheduledMessages[i].webhookUrl + "&messageReplyOption=REPLY_MESSAGE_OR_FAIL",
          payload);
      }
      Logger.log('Scheduled message[%s] has been sent.', scheduledMessages[i].toString())
    } else {
      Logger.log('Scheduled message[%s] has been skipped to send.', scheduledMessages[i].toString())
    }
  }
}