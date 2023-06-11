const express = require("express");
const app = express();
const cors = require("cors");
var jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, massage: "unauthorized access" });
  }

  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vvq0dey.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
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
    await client.connect();

    const classesCollection = client.db("lingoDB").collection("classes");
    const instructorsCollection = client.db("lingoDB").collection("instructors");
    const usersCollection = client.db("lingoDB").collection("users");
    const cartCollection = client.db("lingoDB").collection("cart");
    const newClassesCollection = client.db("lingoDB").collection("newClasses");
    const paymentCollection = client.db("lingoDB").collection("payments");

    // jwt
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "8h",
      });
      res.send({ token });
    });

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      if (user?.role !== "admin") {
        return res.status(403).send({ error: true, message: "forbidden" });
      }
      next();
    };

    // classes related apis
    app.get("/classes", async (req, res) => {
      const email = req.query.email

      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    app.get("/classes-sort", async (req, res) => {
      const result = await classesCollection
        .find()
        .sort({ total_students: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // new classes related apis
    app.get("/new-classes/all", verifyJWT, async (req, res) => {
      const email = req.query.email
      // console.log(email)
      if (!email) {
        res.send([])
      }
      const decodedEmail = req.decoded.email

      if (email !== decodedEmail) {
        return res.status(401).send({ error: true, message: "forbidden access" })
      }
      
      const result = await newClassesCollection.find().toArray()
      res.send(result)
    })

    app.get("/new-classes", verifyJWT, async (req, res) => {
      const email = req.query.email
      if (!email) {
        res.send([])
      }
      const decodedEmail = req.decoded.email

      if (email !== decodedEmail) {
        return res.status(401).send({ error: true, message: "forbidden access" })
      }

      const query = { email: email }
      const result = await newClassesCollection.find(query).toArray()
      res.send(result)
    })


    app.post('/new-classes', async (req, res) => {
      const item = req.body
      
      const result = await newClassesCollection.insertOne(item)
      // console.log(result)
      res.send(result)
    })

    app.patch('/new-classes/approved/:id', async (req, res) => {
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          status: "approved"
        }
      }
      const result = await newClassesCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    app.patch('/new-classes/deny/:id', async (req, res) => {
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          status: "denied"
        }
      }
      const result = await newClassesCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })


    // cart related apis
    app.get("/cart", verifyJWT, async (req, res) => {
      const email = req.query.email
      if (!email) {
        res.send([])
      }
      const decodedEmail = req.decoded.email

      if (email !== decodedEmail) {
        return res.status(401).send({ error: true, message: "forbidden access" })
      }

      const query = { email: email }
      const result = await cartCollection.find(query).toArray()
      res.send(result)
    })

    app.post("/cart", async (req, res) => {
      const item = req.body
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });

    app.get("/cart/:id", async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/cart/:id", async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // instructors related apis
    app.get("/instructors", async (req, res) => {
      const result = await instructorsCollection.find().toArray();
      res.send(result);
    });

    // users related apis
    app.get("/users", verifyJWT, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // check admin role
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    // check instructor role
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    // check student role
    app.get("/users/student/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ student: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { student: user?.role === "student" };
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch("/new-classes/feedback/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          feedback: "instructor",
        },
      };
      const result = await newClassesCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });


    // create payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });


    // payment related apis
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body
      const insertResult = await paymentCollection.insertOne(payment)

      const query = {
        _id: new ObjectId(payment.cartItems)
      }
      
      const deleteResult = await cartCollection.deleteOne(query)
      res.send({ result: insertResult, deleteResult })
    })

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
  res.send("Foreigners are communicating");
});

app.listen(port, () => {
  console.log(`Foreigners are communicating on port ${port}`);
});
