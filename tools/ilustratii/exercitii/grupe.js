// Ilustrațiile implicite pe grupe, pentru exercițiile create de tine (fără ilustrație proprie).
// Folosesc mișcarea cea mai reprezentativă a grupei; mușchii evidențiați sunt cei ai grupei.
'use strict';
const piept = require('./piept');
const spate = require('./spate');
const umeri = require('./umeri');
const brate = require('./brate');
const picioare = require('./picioare');
const abdomen = require('./abdomen');

module.exports = {
  'grupa:Piept': piept['Împins cu gantere pe bancă'],
  'grupa:Spate': spate['Ramat cu bara'],
  'grupa:Umeri': umeri['Împins cu gantere deasupra capului'],
  'grupa:Biceps': brate['Flexii cu bara'],
  'grupa:Triceps': brate['Extensii triceps la scripete'],
  'grupa:Antebrațe': brate['Flexii de încheietură, palmele în sus'],
  'grupa:Cvadricepși': picioare['Genuflexiuni fără greutăți'],
  'grupa:Femurali': picioare['Îndreptări românești'],
  'grupa:Fese': picioare['Hip thrust'],
  'grupa:Gambe': picioare['Ridicări pe vârfuri cu gantere'],
  'grupa:Abdomen': abdomen['Crunch'],
  'grupa:Picioare': picioare['Genuflexiuni cu bara'],
};
