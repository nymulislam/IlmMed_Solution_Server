const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require('jsonwebtoken')
require('dotenv').config()

// MiddleWare
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 5000;



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
        await client.connect();

        const usersCollection = client.db('ilmMedDB').collection('allUsers')

        // normal routes start

        // ----------------------

        // normal routes end


        // jwt token
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SEC, { expiresIn: '2h' })
            res.send({ token })
        })

        // jwt to use by middleware
        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'Access forbidden' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SEC, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'Access forbidden' })
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
        app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result)
        })

        // verify admin
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
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