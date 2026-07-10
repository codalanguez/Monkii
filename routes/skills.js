/**
 * routes/skills.js — REST endpoints for skill discovery.
 *
 * Lets the UI list available skills (for the project toggles and the "/"
 * invocation popup) and fetch a single skill's parsed body. Skills live on
 * disk and are rescanned on every request, so dropping a new SKILL.md folder
 * in takes effect without restarting.
 */
const express = require('express');
const { SKILLS_DIR } = require('../lib/config');
const { scanSkills, skillBody } = require('../lib/skills');

const router = express.Router();

router.get('/skills', (req, res) => res.json({ dir: SKILLS_DIR, skills: scanSkills() }));

router.get('/skills/:sid', (req, res) => {
  try { res.json(skillBody(req.params.sid)); }
  catch { res.status(404).json({ error: 'skill not found' }); }
});

module.exports = router;
