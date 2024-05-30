import express from "express";
import { gamePrisma } from "../utils/prisma/index.js";

const router = express.Router();

/* 아이템 생성 API */
router.post("/items", async (req, res, next) => {
  try {
    const { item_code, item_name, item_stat, item_price } = req.body;

    const isExistItem = await gamePrisma.items.findFirst({
      where: {
        item_name,
      },
    });

    if (isExistItem) {
      return res.status(409).json({
        errorMessage: "이미 존재하는 아이템입니다.",
      });
    }

    if (!item_code || !item_name || !item_price) {
      return res.status(401).json({
        errorMessage: "아이템 코드와 이름, 가격은 필수 입력 사항입니다.",
      });
    }

    // item_stat이 제공되었을 경우 유효성 검사 수행
    if (item_stat) {
      const validKeys = ["health", "power"];
      const statKeys = Object.keys(item_stat);

      // 키 유효성 검사
      for (let key of statKeys) {
        if (!validKeys.includes(key)) {
          return res.status(400).json({
            errorMessage: "item_stat에는 'health'와 'power' 값만 입력해주세요.",
          });
        }
      }
    }

    await gamePrisma.items.create({
      data: {
        item_code,
        item_name,
        item_stat,
        item_price,
      },
    });

    return res.status(201).json({
      message: `새로운 아이템 '${item_name}'가 생성되었습니다.`,
    });
  } catch (err) {
    next(err);
  }
});

/* 아이템 수정 API */
router.patch("/items/:itemCode", async (req, res, next) => {
  try {
    const { itemCode } = req.params;
    const { item_name, item_stat } = req.body;

    const item = await gamePrisma.items.findFirst({
      where: {
        item_code: +itemCode,
      },
    });

    if (!item) {
      return res.status(404).json({
        errorMessage: "존재하지 않는 아이템입니다.",
      });
    }

    // item_stat이 제공되었을 경우 유효성 검사 수행
    if (item_stat) {
      const validKeys = ["health", "power"];
      const statKeys = Object.keys(item_stat);

      // 키 유효성 검사
      for (let key of statKeys) {
        if (!validKeys.includes(key)) {
          return res.status(400).json({
            errorMessage: "item_stat에는 'health'와 'power' 값만 입력해주세요.",
          });
        }
      }
    }

    // 업데이트할 데이터 구성
    const updateData = {};
    if (item_name) updateData.item_name = item_name;
    if (item_stat) updateData.item_stat = item_stat;

    const updatedItem = await gamePrisma.items.update({
      where: {
        item_code: +itemCode,
      },
      data: updateData,
    });

    return res.status(200).json({
      message: "아이템이 성공적으로 업데이트되었습니다.",
      item_name: updatedItem.item_name,
      item_stat: {
        health: item_stat.health,
        power: item_stat.power,
      },
    });
  } catch (err) {
    next(err);
  }
});

/* 아이템 목록 조회 API */
router.get("/items", async (req, res, next) => {
  try {
    const items = await gamePrisma.items.findMany({
      select: {
        item_code: true,
        item_name: true,
        item_price: true,
      },
      orderBy: {
        item_code: "asc",
      },
    });

    return res.status(200).json({ items });
  } catch (err) {
    next(err);
  }
});

/* 아이템 상세 조회 API */
router.get("/items/:itemCode", async (req, res, next) => {
  try {
    const { itemCode } = req.params;

    const item = await gamePrisma.items.findFirst({
      where: {
        item_code: +itemCode,
      },
      select: {
        item_code: true,
        item_name: true,
        item_stat: true,
        item_price: true,
      },
    });

    if (!item) {
      return res.status(404).json({
        errorMessage: "존재하지 않는 아이템입니다.",
      });
    }

    return res.status(200).json({ item });
  } catch (err) {
    next(err);
  }
});

export default router;
