class ItemController {
    constructor(itemModel) {
        this.itemModel = itemModel;
    }

    async getItems(req, res) {
        if (!this.itemModel) {
            return res.status(503).json({ message: 'Item model unavailable' });
        }

        try {
            const items = await this.itemModel.find();
            return res.status(200).json(items);
        } catch (error) {
            return res.status(500).json({ message: 'Error fetching items', error: error.message });
        }
    }

    async addItem(req, res) {
        if (!this.itemModel) {
            return res.status(503).json({ message: 'Item model unavailable' });
        }

        const newItem = new this.itemModel(req.body);
        try {
            const savedItem = await newItem.save();
            return res.status(201).json(savedItem);
        } catch (error) {
            return res.status(400).json({ message: 'Error adding item', error: error.message });
        }
    }
}

module.exports = {
    ItemController
};
