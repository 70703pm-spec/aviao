class ItemController {
    constructor(itemModel) {
        this.itemModel = itemModel;
    }

    async getItems(req, res) {
        try {
            const items = await this.itemModel.find();
            res.status(200).json(items);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching items', error });
        }
    }

    async addItem(req, res) {
        const newItem = new this.itemModel(req.body);
        try {
            const savedItem = await newItem.save();
            res.status(201).json(savedItem);
        } catch (error) {
            res.status(400).json({ message: 'Error adding item', error });
        }
    }
}

export default ItemController;