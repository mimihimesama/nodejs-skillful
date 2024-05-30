import express from "express";
import ErrorHandlingMiddleware from "./middlewares/error-handling.middleware.js";
import UsersRouter from "./routes/users.router.js";
import CharactersRouter from "./routes/characters.router.js";
import ItemsRouter from "./routes/items.router.js";
import MarketRouter from "./routes/market.router.js";

const app = express();
const PORT = 3018;

app.use(express.json());
app.use("/api", [UsersRouter, CharactersRouter, ItemsRouter, MarketRouter]);
app.use(ErrorHandlingMiddleware);

app.listen(PORT, () => {
  console.log(PORT, "포트로 서버가 열렸어요!");
});
