

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const path = require("path");

const app = express();
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root123",
    database: "lostfound"
});
db.connect((err) => {
    if(err){
        console.log(err);
    }
    else{
        console.log("MySQL Connected");
        ensureSchema();
    }
});

function ensureColumn(tableName, columnName, definition) {
    const checkSql = `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
    `;

    db.query(checkSql, [tableName, columnName], (err, rows) => {
        if (err) {
            return console.log(err);
        }

        if (rows.length === 0) {
            db.query(
                `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`,
                alterErr => {
                    if (alterErr) {
                        console.log(alterErr);
                    }
                }
            );
        }
    });
}

function ensureSchema() {
    ensureColumn("items", "dateReported", "DATE NULL");
    ensureColumn("items", "reportedBy", "VARCHAR(100) NULL");
    ensureColumn("items", "createdAt", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
}


app.use(cors());
app.use(express.json({limit: "50mb"}));
app.use(express.urlencoded({limit: "50mb", extended: true}));
app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "login.html"));
});
app.post("/register",(req,res) => {
    const { username,email,password } = req.body;
        const sql = "INSERT INTO users (username,email,password) VALUES (?,?,?)";
        db.query(sql,[username,email,password],(err,result) => {
            if(err) {
               console.log(err);
               res.status(500).send("err");
            
            } else {
                res.send("user registered successfully");
            }
        });
});
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    const sql = "SELECT id, username, email FROM users WHERE username = ? AND password = ? LIMIT 1";

    db.query(sql, [username, password], (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).send("Login failed");
        }

        if (result.length === 0) {
            return res.status(401).send("Invalid credentials");
        }

        res.json(result[0]);
    });
});
app.post("/addItem",(req,res) => {
    const {
        itemName,
        category,
        description,
        location,
        status,
        contact,
        image,
        dateReported,
        reportedBy
    } =  req.body;
    const sql = `INSERT INTO items
    (itemName,category,description,location,status,contact,image,dateReported,reportedBy) VALUES (?,?,?,?,?,?,?,?,?)`;
    db.query(sql,[itemName,category,description,location,status,contact,image,dateReported || null,reportedBy || null],(err,result) => {
        if(err) {
            console.log(err);
            res.status(500).send(err);
        } else {

            res.send("item added successfully");
        }
    }
);
});
app.get("/items", (req, res) => {

    const sql = "SELECT * FROM items";

    db.query(sql, (err, result) => {

        if (err) {
            console.log(err);
            res.status(500).send("Database Error");
        }

        else {
            res.json(result);
        }
    });
});
app.put("/updateStatus/:id", (req, res) => {

    const { status } = req.body;

    const sql = "UPDATE items SET status = ? WHERE id = ?";

    db.query(sql, [status, req.params.id], (err, result) => {

        if(err){
            console.log(err);
            res.status(500).send("Error");
        }

        else{
            res.send("Status Updated");
        }
    });
});
app.delete("/deleteItem/:id", (req, res) => {

    const sql = "DELETE FROM items WHERE id = ?";

    db.query(sql, [req.params.id], (err, result) => {

        if(err){
            console.log(err);
            res.status(500).send("Delete Failed");
        }

        else{
            res.send("Item Deleted");
        }
    });
});
app.put("/editItem/:id", (req, res) => {
    console.log(req.body);
console.log(req.params.id);

    const {
        itemName,
        category,
        description,
        location,
        contact
    } = req.body;

    const sql = `
    UPDATE items
    SET itemName=?,
        category=?,
        description=?,
        location=?,
        contact=?
    WHERE id=?
    `;

    db.query(
        sql,
        [
            itemName,
            category,
            description,
            location,
            contact,
            req.params.id
        ],

        (err, result) => {

            if(err){
                console.log(err);
                res.status(500).send("Edit Failed");
            }

            else{
                res.send("Item Updated");
            }
        }
    );
});
function extractKeywords(text) {

    const stopWords = [
        "the","a","an","and","or","with","near","found","lost",
        "item","items","for","to","of","on","in","at","by"
    ];

    return text
        .toLowerCase()
        .replace(/[^\w\s]/g,"")
        .split(/\s+/)
        .filter(word =>
            word.length > 2 &&
            !stopWords.includes(word)
        );
}
function extractColor(text){

    const colors=[
        "black","white","blue","red","green",
        "yellow","pink","purple","grey","gray",
        "silver","gold","brown","orange"
    ];

    const words=text.toLowerCase().split(/\W+/);

    return colors.find(c=>words.includes(c)) || "";
}
function extractBrand(text){

    const brands=[
        "apple",
        "samsung",
        "hp",
        "dell",
        "lenovo",
        "boat",
        "sony",
        "oneplus",
        "realme",
        "oppo",
        "vivo",
        "asus"
    ];

    const words=text.toLowerCase().split(/\W+/);

    return brands.find(b=>words.includes(b)) || "";
}
function calculateMatchScore(lostItem, foundItem) {

    let score = 0;
    let reasons = [];

    const lostText =
        `${lostItem.itemName} ${lostItem.description} ${lostItem.location}`;

    const foundText =
        `${foundItem.itemName} ${foundItem.description} ${foundItem.location}`;

    const lostKeywords = extractKeywords(lostText);
    const foundKeywords = extractKeywords(foundText);

    
    if (
        lostItem.category.toLowerCase() ===
        foundItem.category.toLowerCase()
    ) {
        score += 20;
        reasons.push("Same Category");
    }

    
    if (
        lostItem.location.toLowerCase() ===
        foundItem.location.toLowerCase()
    ) {
        score += 15;
        reasons.push("Same Location");
    }

    
    const lostBrand = extractBrand(lostText);
    const foundBrand = extractBrand(foundText);

    if (lostBrand && lostBrand === foundBrand) {
        score += 20;
        reasons.push("Brand: " + lostBrand);
    }

    
    const lostColor = extractColor(lostText);
    const foundColor = extractColor(foundText);

    if (lostColor && lostColor === foundColor) {
        score += 15;
        reasons.push("Color: " + lostColor);
    }

   
    const commonWords = lostKeywords.filter(word =>
        foundKeywords.includes(word)
    );

    score += commonWords.length * 5;

    return {

        score: Math.min(score, 100),

        matchedWords: commonWords,

        reasons: reasons
    };
}
console.log("MATCH ROUTE LOADED");
app.get("/matches/:id", (req, res) => {

    const itemId = req.params.id;

    db.query(
        "SELECT * FROM items WHERE id = ?",
        [itemId],
        (err, lostRows) => {

            if (err) {
                console.log(err);
                return res.status(500).send(err);
            }

            if (lostRows.length === 0) {
                return res.status(404).send("item not found");
            }

            const lostItem = lostRows[0];

            db.query(
                "SELECT * FROM items WHERE status = 'found'",
                (err, foundRows) => {

                    if (err) {
                        console.log(err);
                        return res.status(500).send(err);
                    }

                    const matches = foundRows.map(foundItem => {

                        const result = calculateMatchScore(
                            lostItem,
                            foundItem
                        );
                        return {
    id: foundItem.id,
    itemName: foundItem.itemName,
    category: foundItem.category,
    location: foundItem.location,
    image: foundItem.image,
    score: result.score,
    matchedWords: result.matchedWords,
    reasons: result.reasons
};

                    });

                    matches.sort((a, b) => b.score - a.score);

const strongMatches = matches.filter(match => match.score >= 30);

const otherItems = matches.filter(match => match.score < 30);

res.json({
    strongMatches,
    allFoundItems: otherItems
});
                }
            );
        }
    );
});
app.get("/test", (req, res) => {
    console.log("test route hit");
    res.json({
        hello: "world",
        image:"yes"
    });
});
app.listen(5001,() => {
    console.log("server running on port 5001");
});
