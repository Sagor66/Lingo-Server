const express = require('express')
const app = express()
const cors = require("cors")
require("dotenv").config()

const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())


const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization
  if (!authorization) {
    return res.status(401).send({ error: true, massage: "unauthorized access" })
  }

  const token = authorization.split(" ")[1]

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: "unauthorized access" })
    }
    req.decoded = decoded
    next()
  })
}



const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vvq0dey.mongodb.net/?retryWrites=true&w=majority`;

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

    classesCollection = client.db("lingoDB").collection("classes")
    instructorsCollection = client.db("lingoDB").collection("instructors")
    usersCollection = client.db("lingoDB").collection("users")


    // jwt
    app.post("/jwt", (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process,env.ACCESS_TOKEN_SECRET, {
        expiresIn: "8h",
      })
      res.send({ token })
    })

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email
      const query = { email: email }
      const user = await usersCollection.findOne(query)

      if (user?.role !== "admin") {
        return res.status(403).send({ error: true, message: "forbidden" })
      }
      next()
    }


    // classes related apis
    app.get('/classes', async (req, res) => {
      const result = await classesCollection.find().toArray()
      res.send(result)
    })
    
    app.get('/classes-sort', async (req, res) => {
      const result = await classesCollection.find().sort({ total_students: -1 }).limit(6).toArray()
      res.send(result)
    })


    // instructors related apis
    app.get('/instructors', async (req, res) => {
      const result = await instructorsCollection.find().toArray()
      res.send(result)
    })



    // users related apis
    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    app.post('/users', async (req, res) => {
      const user = req.body
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: "User already exists" })
      }
      const result = await usersCollection.insertOne(user)
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('Foreigners are communicating')
})

app.listen(port, () => {
  console.log(`Foreigners are communicating on port ${port}`)
})