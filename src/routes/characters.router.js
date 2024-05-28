import express from "express";
import { prisma } from "../utils/prisma/index.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

/* 캐릭터 생성 API */
router.post("/characters", authMiddleware, async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { name } = req.body;

    const isExistCharacter = await prisma.characters.findFirst({
      where: {
        name,
      },
    });

    if (isExistCharacter) {
      return res.status(409).json({ errorMessage: "이미 존재하는 캐릭터입니다." });
    }

    const character = await prisma.characters.create({
      data: {
        userId: +userId,
        name,
      },
    });

    return res.status(201).json({
      message: `새로운 캐릭터 ‘${name}’를 생성하셨습니다!`,
      characterId: character.characterId,
    });
  } catch (err) {
    next(err);
  }
});

/* 캐릭터 삭제 API */
router.delete("/characters/:characterId", authMiddleware, async (req, res, next) => {
  try {
    const { characterId } = req.params;
    const { userId } = req.user;

    const character = await prisma.characters.findFirst({
      where: {
        characterId: +characterId,
      },
    });

    // 캐릭터가 존재하지 않을 경우
    if (!character) {
      return res.status(404).json({
        errorMessage: "존재하지 않는 캐릭터입니다.",
      });
    }

    // 캐릭터가 내 계정의 캐릭터인지 검증
    if (character.userId !== +userId) {
      return res.status(403).json({
        errorMessage: "해당 캐릭터는 삭제할 수 없습니다. 권한이 없습니다.",
      });
    }

    await prisma.characters.delete({
      where: {
        characterId: +characterId,
      },
    });

    return res.status(200).json({
      message: `캐릭터 '${character.name}'를 삭제했습니다.`,
    });
  } catch (err) {
    next(err);
  }
});

/* 캐릭터 상세 조회 API */
router.get("/characters/:characterId", authMiddleware, async (req, res, next) => {
  try {
    const { characterId } = req.params;
    const { userId } = req.user;

    const character = await prisma.characters.findFirst({
      where: { characterId: +characterId },
    });

    if (!character) {
      return res.status(404).json({ errorMessage: "캐릭터를 찾을 수 없습니다." });
    }

    if (character.userId === userId) {
      // 내가 내 캐릭터를 조회하는 경우
      return res.status(200).json({
        name: character.name,
        health: character.health,
        power: character.power,
        money: character.money,
      });
    } else {
      // 로그인 하지 않았거나 다른 유저가 내 캐릭터를 조회하는 경우
      return res.status(200).json({
        name: character.name,
        health: character.health,
        power: character.power,
      });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
