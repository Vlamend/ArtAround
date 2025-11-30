import Item from '../models/Item.js';

export async function getItems(req, res) {
  const items = await Item.find();
  res.json(items);
}

export async function createItem(req, res) {
  const item = await Item.create(req.body);
  res.json(item);
}
