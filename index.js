require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.x65kkeb.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

async function run() {
	try {
		// Connect the client to the server	(optional starting in v4.7)
		// await client.connect();

		const db = client.db("zap_shift_db");
		const parcelsCollection = db.collection("parcels");

		// Parcels API's
		app.get("/parcels", async (req, res) => {
			const query = {};
			const { email } = req.query;
			if (email) {
				query.senderEmail = email;
			}
			const options = { sort: { created_at: -1 } };
			const cursor = parcelsCollection.find(query, options);
			const result = await cursor.toArray();
			res.send(result);
		});

		app.post("/parcels", async (req, res) => {
			const parcel = req.body;
			parcel.created_at = new Date();
			const result = await parcelsCollection.insertOne(parcel);
			res.send(result);
		});

		app.delete("/parcels/:id", async (req, res) => {
			const { id } = req.params;
			const query = { _id: new ObjectId(id) };
			const result = await parcelsCollection.deleteOne(query);
			res.send(result);
		});

		// Send a ping to confirm a successful connection
		await client.db("admin").command({ ping: 1 });
		console.log(
			"Pinged your deployment. You successfully connected to MongoDB!"
		);
	} finally {
		// Ensures that the client will close when you finish/error
		// await client.close();
	}
}
run().catch(console.dir);

app.get("/", (req, res) => {
	res.send("ZapShift Server is running soomthly!");
});

app.listen(port, () => {
	console.log(`Example app listening on port ${port}`);
});
