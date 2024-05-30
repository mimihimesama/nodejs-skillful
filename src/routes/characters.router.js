import express from "express";
import { userPrisma } from "../utils/prisma/index.js";
import { gamePrisma } from "../utils/prisma/index.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

/* 캐릭터 생성 API */
router.post("/characters", authMiddleware, async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { name } = req.body;

    const isExistCharacter = await userPrisma.characters.findFirst({
      where: {
        name,
      },
    });

    if (isExistCharacter) {
      return res.status(409).json({ errorMessage: "이미 존재하는 캐릭터입니다." });
    }

    const character = await userPrisma.characters.create({
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

    const character = await userPrisma.characters.findFirst({
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

    await userPrisma.characters.delete({
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
router.get("/characters/:characterId", async (req, res, next) => {
  try {
    const { characterId } = req.params;
    const authorization = req.header("authorization");

    const character = await userPrisma.characters.findFirst({
      where: {
        characterId: +characterId,
        userId: +userId,
      },
    });

    if (!character) {
      return res.status(404).json({ errorMessage: "캐릭터를 찾을 수 없습니다." });
    }

    // 내가 내 캐릭터를 조회하는 경우
    if (authorization) {
      const [tokenType, token] = authorization.split(" ");
      if (tokenType !== "Bearer") throw new Error("토큰 타입이 일치하지 않습니다.");

      const decodedToken = jwt.verify(token, process.env.SESSION_SECRET_KEY);
      const userId = decodedToken.userId;

      const user = await userPrisma.users.findFirst({ where: { userId: +userId } });
      if (!user) throw new Error("토큰 사용자가 존재하지 않습니다.");

      if (character.userId === userId) {
        return res.status(200).json({
          name: character.name,
          health: character.health,
          power: character.power,
          money: character.money,
        });
      }
    }

    // 로그인 하지 않았거나 다른 유저가 내 캐릭터를 조회하는 경우
    return res.status(200).json({
      name: character.name,
      health: character.health,
      power: character.power,
    });
  } catch (err) {
    next(err);
  }
});

// 도전 요구 사항 -------------------------------------------------------------------------------------------------------------

/* 캐릭터가 보유한 인벤토리 내 아이템 목록 조회 API */
router.get("/characters/:characterId/inventory", authMiddleware, async (req, res, next) => {
  try {
    const { characterId } = req.params;
    const { userId } = req.user;

    const character = await userPrisma.characters.findFirst({
      where: {
        characterId: +characterId,
        userId: +userId,
      },
    });

    // 캐릭터가 존재하지 않을 경우
    if (!character) {
      return res.status(404).json({
        errorMessage: "존재하지 않는 캐릭터입니다.",
      });
    }

    // 해당 캐릭터의 인벤토리 아이템 코드 목록 조회
    const inventoryItems = await userPrisma.inventory.findMany({
      where: {
        characterId: +characterId,
      },
      select: {
        item_code: true,
        count: true,
      },
    });

    // 아이템 코드 배열 추출
    const itemCodes = inventoryItems.map((item) => item.item_code);

    // 게임 아이템 정보 조회
    const items = await gamePrisma.items.findMany({
      where: {
        item_code: {
          in: itemCodes,
        },
      },
      select: {
        item_code: true,
        item_name: true,
      },
    });

    // 응답 데이터 매핑
    const responseData = inventoryItems.map((inventoryItem) => {
      const itemDetail = items.find((item) => item.item_code === inventoryItem.item_code);
      return {
        item_code: inventoryItem.item_code,
        item_name: itemDetail.item_name,
        count: inventoryItem.count,
      };
    });

    // 정렬 및 응답
    responseData.sort((a, b) => a.item_code - b.item_code);
    return res.status(200).json({
      data: responseData,
    });
  } catch (err) {
    next(err);
  }
});

/* 아이템 장착 API */
router.post("/characters/:characterId/equip", authMiddleware, async (req, res, next) => {
  try {
    const { characterId } = req.params;
    const { userId } = req.user;
    const { item_code } = req.body;

    const character = await userPrisma.characters.findFirst({
      where: {
        characterId: +characterId,
        userId: +userId,
      },
    });

    // 캐릭터가 존재하지 않을 경우
    if (!character) {
      return res.status(404).json({
        errorMessage: "존재하지 않는 캐릭터입니다.",
      });
    }

    const inven = await userPrisma.inventory.findFirst({
      where: {
        characterId: +characterId,
        item_code,
      },
    });

    if (!inven) {
      return res.status(404).json({
        message: "인벤토리에 없는 아이템입니다.",
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
        message: "이미 장착한 아이템입니다.",
      });
    }

    await userPrisma.equip.create({
      data: {
        characterId: +characterId,
        item_code,
      },
    });

    if (inven.count === 1) {
      await userPrisma.inventory.delete({
        where: {
          inventoryId: inven.inventoryId,
          characterId: +characterId,
          item_code,
        },
      });
    } else {
      await userPrisma.inventory.update({
        where: {
          inventoryId: inven.inventoryId,
          characterId: +characterId,
          item_code,
        },
        data: {
          count: inven.count - 1,
        },
      });
    }

    const equipItem = await gamePrisma.items.findFirst({
      where: {
        item_code,
      },
    });

    // 캐릭터의 스탯을 업데이트하기 위한 로직
    const statsToUpdate = {};
    if (equipItem.item_stat.health) {
      statsToUpdate.health = { increment: equipItem.item_stat.health };
    }
    if (equipItem.item_stat.power) {
      statsToUpdate.power = { increment: equipItem.item_stat.power };
    }

    const changed = await userPrisma.characters.update({
      where: {
        characterId: +characterId,
        userId: +userId,
      },
      data: statsToUpdate,
    });

    res.status(200).json({
      message: `"${equipItem.item_name}"을(를) 장착했습니다!`,
      characterStats: {
        health: changed.health,
        power: changed.power,
      },
    });
  } catch (err) {
    next(err);
  }
});

/* 아이템 탈착 API */
router.post("/characters/:characterId/unequip", authMiddleware, async (req, res, next) => {
  try {
    const { characterId } = req.params;
    const { userId } = req.user;
    const { item_code } = req.body;

    // 캐릭터 정보 확인
    const character = await userPrisma.characters.findFirst({
      where: {
        characterId: +characterId,
        userId: +userId,
      },
    });

    if (!character) {
      return res.status(404).json({
        errorMessage: "존재하지 않는 캐릭터입니다.",
      });
    }

    // 장착된 아이템 확인
    const equippedItem = await userPrisma.equip.findFirst({
      where: {
        characterId: +characterId,
        item_code,
      },
    });

    if (!equippedItem) {
      return res.status(404).json({
        message: "장착하지 않은 아이템입니다.",
      });
    }

    // 아이템 탈착 처리
    await userPrisma.equip.delete({
      where: {
        equipId: equippedItem.equipId,
        characterId: +characterId,
        item_code,
      },
    });

    // 아이템 정보 확인
    const equipItem = await gamePrisma.items.findFirst({
      where: {
        item_code,
      },
    });

    // 캐릭터 스탯 업데이트 (감소)
    const statsToUpdate = {};
    if (equipItem.item_stat.health) {
      statsToUpdate.health = { decrement: equipItem.item_stat.health };
    }
    if (equipItem.item_stat.power) {
      statsToUpdate.power = { decrement: equipItem.item_stat.power };
    }

    const changed = await userPrisma.characters.update({
      where: {
        characterId: +characterId,
        userId: +userId,
      },
      data: statsToUpdate,
    });

    // 인벤토리 아이템 수량 업데이트 (증가)
    const inventoryItem = await userPrisma.inventory.findFirst({
      where: {
        characterId: +characterId,
        item_code,
      },
    });

    if (inventoryItem) {
      await userPrisma.inventory.update({
        where: {
          inventoryId: inventoryItem.inventoryId,
          characterId: +characterId,
          item_code,
        },
        data: {
          count: inventoryItem.count + 1,
        },
      });
    } else {
      await userPrisma.inventory.create({
        data: {
          characterId: +characterId,
          item_code,
          count: 1,
        },
      });
    }

    res.status(200).json({
      message: `"${equipItem.item_name}"을(를) 탈착했습니다`,
      characterStats: {
        health: changed.health,
        power: changed.power,
      },
    });
  } catch (err) {
    next(err);
  }
});

/* 캐릭터가 보유한 인벤토리 내 아이템 목록 조회 API */
router.get("/characters/:characterId/equip", async (req, res, next) => {
  try {
    const { characterId } = req.params;

    const character = await userPrisma.characters.findFirst({
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

    const equip = await userPrisma.equip.findMany({
      where: {
        characterId: +characterId,
      },
    });

    const data = await gamePrisma.items.findMany({
      where: {
        item_code: {
          in: equip.map(({ item_code }) => item_code),
        },
      },
      select: {
        item_code: true,
        item_name: true,
      },
      orderBy: {
        item_code: "asc",
      },
    });

    return res.status(200).json({ message: `"${character.name}"님의 장착 아이템 목록`, items: data });
  } catch (err) {
    next(err);
  }
});

/* 게임 머니를 버는 API */
router.patch("/characters/:characterId/makemoney", authMiddleware, async (req, res, next) => {
  try {
    const { characterId } = req.params;
    const { userId } = req.user;

    const character = await userPrisma.characters.findFirst({
      where: {
        characterId: +characterId,
        userId: +userId,
      },
    });

    // 캐릭터가 존재하지 않을 경우
    if (!character) {
      return res.status(404).json({
        errorMessage: "존재하지 않는 캐릭터입니다.",
      });
    }

    await userPrisma.characters.update({
      where: {
        characterId: +characterId,
        userId: +userId,
      },
      data: {
        money: character.money + 100,
      },
    });

    return res.status(200).json({
      message: "게임 머니를 100원 얻었습니다.",
      money: character.money,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
