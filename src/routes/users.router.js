import express from "express";
import { prisma } from "../utils/prisma/index.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = express.Router();

/* 사용자 회원가입 API */
const emailRegex = /^(?=[a-z0-9]{5,20}$)(?=.*[a-z])(?=.*[0-9])[a-z0-9]+$/;
const passwordMinLength = 6;

router.post("/sign-up", async (req, res, next) => {
  try {
    const { email, password, pwCheck, name } = req.body;

    if (!emailRegex.test(email)) {
      return res.status(400).json({ errorMessage: "아이디 형식이 유효하지 않습니다. 영문(소문자)과 숫자로 조합된 5~20글자로 생성해주세요." });
    }

    if (password.length < passwordMinLength) {
      return res.status(400).json({ errorMessage: `비밀번호는 최소 ${passwordMinLength}자 이상이어야 합니다.` });
    }

    if (password !== pwCheck) {
      return res.status(400).json({ errorMessage: "비밀번호가 일치하지 않습니다." });
    }

    const isExistUser = await prisma.users.findFirst({
      where: {
        email,
      },
    });

    if (isExistUser) {
      return res.status(409).json({ errorMessage: "이미 존재하는 아이디입니다." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.users.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    return res.status(201).json({ message: "회원가입이 완료되었습니다.", ID: email, name });
  } catch (err) {
    next(err);
  }
});

/* 로그인 API */
router.post("/sign-in", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.users.findFirst({ where: { email } });
    if (!user) return res.status(401).json({ errorMessage: "존재하지 않는 아이디입니다." });
    else if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ errorMessage: "비밀번호가 일치하지 않습니다." });

    const token = jwt.sign(
      {
        userId: user.userId,
      },
      process.env.SESSION_SECRET_KEY,
      { expiresIn: "1d" },
    );

    res.setHeader("authorization", `Bearer ${token}`);

    return res.status(200).json({ message: "로그인 성공" });
  } catch (err) {
    next(err);
  }
});

export default router;
