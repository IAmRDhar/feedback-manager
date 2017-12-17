const _ = require('lodash');
const Path = require('path-parser');
const { URL } =require('url');
const mongoose = require('mongoose');
const requireLogin = require('../middlewares/requireLogin');
const requireCredits = require('../middlewares/requireCredits');
const Mailer = require('../services/Mailer');
const surveyTemplate = require('../services/emailTemplates/surveyTemplate');
const Survey = mongoose.model('surveys');


module.exports = app => {
  app.get('/api/surveys/thanks', (req, res) => {
    res.send('Thanks for voting!');
  });
  app.post('/api/surveys/webhooks', (req, res) => {
    /**
     * Mapping through the events and removing all those events
     * that dont have a surveyID or a choice in the pathname
     */

    const p = new Path('/api/surveys/:surveyID/:choice');
    const events = _.chain(req.body)
      .map(({email, url}) => {
        const match = p.test(new URL (url).pathname);
        if(match){
          return { 
            email,
            surveyID: match.surveyID,
            choice: match.choice
          };
        }
      })
      .compact()    //takes an array, removes undefined elements    
      .uniqBy('email', 'surveyID')      //fetch unique events based on email and surveyIDs
      .value();

    res.send({});
  });
  app.post('/api/surveys', requireLogin, requireCredits,  async (req, res) => {
    const { title, subject, body, recipients } = req.body;

    const survey = new Survey({
      title,
      subject,
      body,
      recipients: recipients.split(',').map(email => ({ email: email.trim() })),
      _user: req.user.id,
      dateSent: Date.now()
    });

    //send an email
    const mailer = new Mailer(survey, surveyTemplate(survey));

    try{
      await mailer.send();
      await survey.save();
      req.user.credits -= 1;
      const user = await req.user.save();
      res.send(user);
    }catch(err){
      //unprocessable entity
      res.status(422).send(err);
    }
  });
};
