require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const stripe = require("stripe")(process.env.PAYMENT_SECRET);

const port = process.env.PORT || 3000;

const crypto = require("crypto");

function generateTrackingId() {
	const prefix = "PRCL";
	const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
	const random = crypto.randomBytes(3).toString("hex").toUpperCase();
	return `${prefix}-${date}-${random}`;
}

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
		const paymentCollection = db.collection("payments");

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

		app.get("/parcels/:id", async (req, res) => {
			const { id } = req.params;
			const query = { _id: new ObjectId(id) };
			const result = await parcelsCollection.findOne(query);
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

		// Payment Related API's

		app.post("/payment-checkout-session", async (req, res) => {
			const paymentInfo = req.body;
			const amount = parseInt(paymentInfo.cost) * 100;
			const session = await stripe.checkout.sessions.create({
				line_items: [
					{
						price_data: {
							currency: "usd",
							unit_amount: amount,
							product_data: {
								name: `Please pay for: ${paymentInfo.parcelName}`,
							},
						},
						quantity: 1,
					},
				],
				mode: "payment",
				metadata: {
					parcelId: paymentInfo.parcelId,
					parcelName: paymentInfo.parcelName,
				},
				customer_email: paymentInfo.senderEmail,
				success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
				cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
			});
			res.send({ url: session.url });
		});

		// Old api
		// app.post("/create-checkout-session", async (req, res) => {
		// 	const paymentInfo = req.body;
		// 	const amount = parseInt(paymentInfo.cost) * 100;
		// 	const session = await stripe.checkout.sessions.create({
		// 		line_items: [
		// 			{
		// 				price_data: {
		// 					currency: "USD",
		// 					unit_amount: amount,
		// 					product_data: {
		// 						name: paymentInfo.parcelName,
		// 					},
		// 				},
		// 				quantity: 1,
		// 			},
		// 		],
		// 		mode: "payment",
		// 		metadata: {
		// 			parcelId: paymentInfo.parcelId,
		// 		},
		// 		customer_email: paymentInfo.senderEmail,
		// 		success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success`,
		// 		cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
		// 	});

		// 	res.send({ url: session.url });
		// });

		app.patch("/payment-success", async (req, res) => {
			const sessionId = req.query.session_id;

			const session = await stripe.checkout.sessions.retrieve(sessionId);
			if (session.payment_status === "paid") {
				const id = session.metadata.parcelId;
				const query = { _id: new ObjectId(id) };
				const trackingId = generateTrackingId();
				const update = {
					$set: {
						paymentStatus: "paid",
						trackingId: trackingId,
					},
				};
				const result = await parcelsCollection.updateOne(query, update);

				const payment = {
					amount: session.amount_total / 100,
					currency: session.currency,
					customerEmail: session.customer_email,
					parcelId: session.metadata.parcelId,
					parcelName: session.metadata.parcelName,
					transactionId: session.payment_intent,
					paymentStatus: session.payment_status,
					padi_at: new Date(),
				};

				if (session.payment_status === "paid") {
					const paymentResult = await paymentCollection.insertOne(
						payment
					);
					res.send({
						success: true,
						modifyParcel: result,
						paymentInFo: paymentResult,
						trackingId: trackingId,
						transactionId: session.payment_intent,
					});
				}
			}

			res.send({ success: false });
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
