import Visit from '../models/Visit.js';

export async function getVisits(req, res) {
  const visits = await Visit.find();
  res.json(visits);
}

export async function createVisit(req, res) {
  const visit = await Visit.create(req.body);
  res.json(visit);
}
