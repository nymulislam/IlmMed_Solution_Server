const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require('jsonwebtoken')
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SKY);


const port = process.env.PORT || 5000;


// MiddleWare
app.use(cors());
app.options("*", cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.MDB_USER}:${process.env.MDB_PASS}@cluster0.tloczwa.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const usersCollection = client.db('ilmMedDB').collection('allUsers')
        const divisionsCollection = client.db('ilmMedDB').collection('divisions')
        const districtsCollection = client.db('ilmMedDB').collection('districts')
        const allTestsCollection = client.db('ilmMedDB').collection('allTests')
        const allBannersCollection = client.db('ilmMedDB').collection('allBanners')
        const bookingsCollection = client.db('ilmMedDB').collection('bookings')
        const recommendationsCollection = client.db('ilmMedDB').collection('recommendations')
        const promotionsCollection = client.db('ilmMedDB').collection('promotions')


        // jwt token
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SEC, { expiresIn: '1h' })
            res.send({ token })
        })

        // jwt to use by middleware
        const verifyToken = (req, res, next) => {

            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'Access unauthorized' });
            }

            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SEC, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'Access unauthorized' })
                }
                req.decoded = decoded;
                next();
            })
        }

        // verify admin by middleware
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }

        // users route
        app.get("/users", async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result)
        })

        // verify admin
        app.get('/users/admin/:email',  async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Access unauthorized' })
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })

        // prevent existing user info save in database
        app.post("/users", async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })

        // verify user role
        app.get('/users/status/:email',  async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Access unauthorized' })
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let status = false;
            if (user) {
                status = user?.status === 'active';
            }
            res.send({ active: status });
        })

        // for user info
        app.get("/users/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await usersCollection.findOne(query)
            res.send(result)
        })

        // update user info
        app.put('/users/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateProfile = req.body;
            const info = {
                $set: {
                    name: updateProfile.name,
                    blood: updateProfile.blood,
                    division: updateProfile.division,
                    district: updateProfile.district,
                }
            }
            const options = { upsert: true };
            const result = await usersCollection.updateOne(query, info, options)
            res.send(result)
        })

        // user status handle
        app.patch('/users/status/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            if (!id) {
                return res.status(400).send({ message: 'User ID is required.' })
            }
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: req.body.status || 'active'
                }
            };
            const result = await usersCollection.updateOne(filter, updatedDoc);
            res.send(result)
        })

        // make admin & remove admin
        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            if (!id) {
                return res.status(400).send({ message: 'User ID is required.' })
            }
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: req.body.role || 'user'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        // verify user profile
        app.get('/users/userProfile/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Access unauthorized' })
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send(user);
        })


        // normal routes start


        // home page banner routs start
        app.post('/allBanners', verifyToken, verifyAdmin, async (req, res) => {
            const newBanner = req.body;
            const result = await allBannersCollection.insertOne(newBanner);
            res.send(result)
        })

        app.get('/allBanners', async (req, res) => {
            const result = await allBannersCollection.find().toArray();
            res.send(result)
        })

        app.patch('/allBanners/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            if (!id) {
                return res.status(400).send({ message: 'User ID is required.' })
            }
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: req.body.status || 'block'
                }
            };
            const result = await allBannersCollection.updateOne(filter, updatedDoc);
            res.send(result)
        })

        app.patch('/deactivatedBanners', verifyToken, verifyAdmin, async (req, res) => {
            try {
                const result = await allBannersCollection.updateMany({}, { $set: { status: "block" } });
                res.sendStatus(200);
            } catch (error) {
                console.error("Error deactivating all banners", error);
                res.sendStatus(500);
            }
        })

        app.delete('/allBanners/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await allBannersCollection.deleteOne(query);
            res.send(result);
        })
        // home page banner routs end


        //  all tests routes start
        app.post('/allTests', verifyToken, verifyAdmin, async (req, res) => {
            const newTest = req.body;
            const result = await allTestsCollection.insertOne(newTest);
            res.send(result)
        })

        app.get('/allTests', async (req, res) => {
            const result = await allTestsCollection.find().toArray();
            res.send(result)
        })

        // update test info
        app.put('/allTests/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateTest = req.body;
            const info = {
                $set: {
                    name: updateTest.name,
                    category: updateTest.category,
                    slot: updateTest.slot,
                    price: updateTest.price,
                    deadline: updateTest.deadline,
                    description: updateTest.description,
                    testImage: updateTest.testImage,
                }
            }
            const options = { upsert: true };
            const result = await allTestsCollection.updateOne(query, info, options)
            res.send(result)
        })

        app.get('/allTests/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await allTestsCollection.findOne(query);
            res.send(result)
        })

        app.delete('/allTests/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await allTestsCollection.deleteOne(query);
            res.send(result)
        })


        // payment for test
        app.post('/testPayment', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);

            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: 'usd',
                    payment_method_types: [
                        'card'
                    ]
                })
                res.send({
                    clientSecret: paymentIntent.client_secret
                })

            } catch (error) {
                res.status(500).json({ error: 'Internal Server Error' })
            }
        })
        // all tests routes end


        // booking routes start
        app.post('/allBookings', verifyToken, async (req, res) => {
            const booking = req.body;
            const result = await bookingsCollection.insertOne(booking);
            res.send(result)
        })

        app.get('/allBookings', async (req, res) => {
            const result = await bookingsCollection.find().toArray();
            res.send(result);
        })


        // upcoming appointment
        app.get('/allBookings', verifyToken, async (req, res) => {
            let query = {};
            if (req.query?.email) {
                query = { email: req.query?.email }
            }
            const result = await bookingsCollection.find(query).toArray();
            res.send(result);
        })
        // booking routes end

        // division data
        app.get("/divisions", async (req, res) => {
            const result = await divisionsCollection.find().toArray();
            res.send(result)
        })
        // district data
        app.get("/districts", async (req, res) => {
            const result = await districtsCollection.find().toArray();
            res.send(result)
        })

        app.get('/promotions', async (req, res) => {
            const result = await promotionsCollection.find().toArray();
            res.send(result);
        })

        app.get('/recommendations', async (req, res) => {
            const result = await recommendationsCollection.find().toArray();
            res.send(result);
        })
        // normal routes end




        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('IlmMed Solution is running..')
})

app.listen(port, () => {
    console.log(`IlmMed_Solution_server is running on ${port}`);
})