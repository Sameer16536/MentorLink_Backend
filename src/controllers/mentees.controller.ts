import { PrismaClient } from "@prisma/client";
import { NextFunction, Request, Response } from "express";

const prisma = new PrismaClient();

export const bookSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const user = req.user;
  const { mentorId, slotId, agenda } = req.body;

  try {
    if (user?.role !== "MENTEE") {
      res.status(403).json({
        message: "You are not authorized to book a session",
      });
      return;
    }

    //Book a slot
    const slot = await prisma.mentorAvailability.findUnique({
      where: { id: slotId },
      include: {
        mentor: true,
      },
    });
    if (!slot || slot.isBooked) {
      res.status(404).json({ message: "Slot is not Available" });
      return;
    }

    const session = await prisma.session.create({
      data: {
        mentorId: mentorId,
        mentees: {
          connect: [{ id: user.id }],
        },
        startTime: slot.startTime,
        endTime: slot.endTime,
        agenda: agenda,
        status: "BOOKED",
      },
    });

    await prisma.mentorAvailability.update({
      where: { id: slotId },
      data: { isBooked: true, sessionId: session.id },
    });
    res.status(201).json({
      message: "Session booked successfully",
      session,
      mentor: slot.mentor,
    });
  } catch (error) {
    console.error("Error booking session:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
