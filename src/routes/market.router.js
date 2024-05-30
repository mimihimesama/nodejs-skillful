import express from "express";
import { userPrisma } from "../utils/prisma/index.js";
import { gamePrisma } from "../utils/prisma/index.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

/* 아이템 구입 API */
router.post("/characters/:characterId/buy", authMiddleware, async (req, res, next) => {
  try {
    const { characterId } = req.params;
    const { userId } = req.user;
    const { buy } = req.body;

    const character = await userPrisma.characters.findFirst({
      where: {
        userId: +userId,
        characterId: +characterId,
      },
    });

    if (!character) {
      return res.status(404).json({
        message: "존재하지 않는 캐릭터입니다.",
      });
    }

    let totalCost = 0;
    for (const item of buy) {
      const { item_code, count } = item;

      const itemInfo = await gamePrisma.items.findFirst({
        where: { item_code },
        select: { item_price: true },
      });

      if (!itemInfo) {
        return res.status(404).json({
          message: "존재하지 않는 아이템입니다.",
        });
      }

      totalCost += itemInfo.item_price * count;
    }

    if (character.money < totalCost) {
      return res.status(400).json({
        message: "게임 머니가 부족합니다.",
      });
    }

    await userPrisma.$transaction(async (userPrisma) => {
      for (const item of buy) {
        const { item_code, count } = item;

        // 인벤토리에서 아이템 존재 여부 확인
        const isExistItem = await userPrisma.inventory.findFirst({
          where: {
            characterId: +characterId,
            item_code,
          },
        });

        if (isExistItem) {
          // 아이템이 이미 존재하면 수량만 업데이트
          await userPrisma.inventory.update({
            where: {
              item_code: isExistItem.item_code,
              inventoryId: isExistItem.inventoryId,
            },
            data: {
              count: {
                increment: count,
              },
            },
          });
        } else {
          // 아이템이 존재하지 않으면 새로 추가
          await userPrisma.inventory.create({
            data: {
              characterId: +characterId,
              item_code,
              count,
            },
          });
        }
      }

      await userPrisma.characters.update({
        where: { characterId: +characterId },
        data: { money: { decrement: totalCost } },
      });
    });

    const updatedCharacter = await userPrisma.characters.findFirst({
      where: { characterId: +characterId },
      select: { money: true },
    });

    return res.status(200).json({
      message: "아이템을 구매했습니다.",
      money: updatedCharacter.money,
    });
  } catch (err) {
    next(err);
  }
});

/* 아이템 판매 API */
router.post("/characters/:characterId/sell", authMiddleware, async (req, res, next) => {
  try {
    const { characterId } = req.params;
    const { userId } = req.user;
    const { sell } = req.body;

    const character = await userPrisma.characters.findFirst({
      where: {
        userId: +userId,
        characterId: +characterId,
      },
    });

    if (!character) {
      return res.status(404).json({
        message: "존재하지 않는 캐릭터입니다.",
      });
    }

    await userPrisma.$transaction(async (userPrisma) => {
      let totalSalePrice = 0;

      for (const item of sell) {
        const { item_code, count } = item;

        const inventoryItem = await userPrisma.inventory.findFirst({
          where: {
            characterId: +characterId,
            item_code,
          },
        });

        if (!inventoryItem) {
          return res.status(400).json({
            message: "인벤토리에 해당 아이템이 없습니다.",
          });
        }

        if (inventoryItem.count < count) {
          return res.status(400).json({
            message: "인벤토리에 아이템 수량이 부족합니다.",
          });
        }

        const equippedItem = await userPrisma.equip.findFirst({
          where: {
            characterId: +characterId,
            item_code,
          },
        });

        if (equippedItem) {
          return res.status(400).json({
            message: "장착 중인 아이템은 판매할 수 없습니다.",
          });
        }

        const itemInfo = await gamePrisma.items.findFirst({
          where: { item_code },
          select: { item_price: true },
        });

        if (!itemInfo) {
          return res.status(404).json({
            message: `아이템 코드 ${item_code}를 찾을 수 없습니다.`,
          });
        }

        const salePrice = count * Math.floor(itemInfo.item_price * 0.6);
        totalSalePrice += salePrice;

        if (inventoryItem.count === count) {
          await userPrisma.inventory.delete({
            where: { inventoryId: inventoryItem.inventoryId },
          });
        } else {
          await userPrisma.inventory.update({
            where: { inventoryId: inventoryItem.inventoryId },
            data: { count: { decrement: count } },
          });
        }
      }

      await userPrisma.characters.update({
        where: { characterId: +characterId },
        data: { money: { increment: totalSalePrice } },
      });
    });

    const updatedCharacter = await userPrisma.characters.findFirst({
      where: { characterId: +characterId },
      select: { money: true },
    });

    return res.status(200).json({
      message: "아이템을 판매했습니다.",
      money: updatedCharacter.money,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
