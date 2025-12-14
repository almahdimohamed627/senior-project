import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, or } from 'drizzle-orm';
import { db } from 'src/modules/auth/client';
import { ChatService } from 'src/modules/chat/chat.service';
import { users } from 'src/db/schema/profiles.schema';
import { requests } from 'src/db/schema/request.schema';

@Injectable()
export class RequestService {
  constructor( private chatService: ChatService) {}

  async getReceivedRequests(userId: string) {
    return db
      .select()
      .from(requests)
      .where(eq(requests.receiverId, userId));
  }

  async getSentRequests(userId: string) {
    return db
      .select()
      .from(requests)
      .where(eq(requests.senderId, userId));
  }

  async getAcceptedRelations(userId: string) {
    const asSender = await db
      .select()
      .from(requests)
      .where(
        and(
          eq(requests.senderId, userId),
          eq(requests.status, 'accepted'),
        ),
      );

    const asReceiver = await db
      .select()
      .from(requests)
      .where(
        and(
          eq(requests.receiverId, userId),
          eq(requests.status, 'accepted'),
        ),
      );

    return {
      asSender,
      asReceiver,
    };
  }

  async sendRequest(senderId: string, receiverId: string) {
    if (senderId === receiverId) {
      return 'cannot send request to yourself';
    }

    return db.transaction(async (tx) => {
      const [sender] = await tx
        .select({
          id: users.fusionAuthId,
          role: users.role,
        })
        .from(users)
        .where(eq(users.fusionAuthId, senderId));

      const [receiver] = await tx
        .select({
          id: users.fusionAuthId,
          role: users.role,
        })
        .from(users)
        .where(eq(users.fusionAuthId, receiverId));

      if (!sender || !receiver) {
        return 'sender or receiver not found';
      }

      const isDoctorPatientPair =
        (sender.role === 'doctor' && receiver.role === 'patient') ||
        (sender.role === 'patient' && receiver.role === 'doctor');

      if (!isDoctorPatientPair) {
        return 'invalid request: roles not compatible';
      }

      const pairCondition = this.buildPairCondition(senderId, receiverId);

      const existingPendingOrAccepted = await tx
        .select({ id: requests.id })
        .from(requests)
        .where(
          and(pairCondition, inArray(requests.status, ['pending', 'accepted'])),
        );

      if (existingPendingOrAccepted.length > 0) {
        return 'request already exists or accepted between users';
      }

      const [created] = await tx
        .insert(requests)
        .values({
          senderId,
          receiverId,
        })
        .returning();

      return created;
    });
  }

  async acceptOrReject(accepted: boolean, senderId: string, receiverId: string) {
    const newStatus = accepted ? 'accepted' : 'rejected';
    const pairCondition = this.buildPairCondition(senderId, receiverId);

    const [updated] = await db
      .update(requests)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(and(pairCondition, eq(requests.status, 'pending')))
      .returning();

    if (!updated) {
      return 'no pending request found for this pair';
    }

    if (newStatus === 'accepted') {
      await this.chatService.ensureConversationForRequest(
        updated.id,
        updated.senderId,
        updated.receiverId,
      );
    }

    return updated;
  }

  async cancelRequest(senderId: string, receiverId: string) {
    const deleted = await db
      .delete(requests)
      .where(
        and(
          eq(requests.senderId, senderId),
          eq(requests.receiverId, receiverId),
          eq(requests.status, 'pending'),
        ),
      )
      .returning({ id: requests.id });

    if (!deleted.length) {
      return 'no pending request to cancel';
    }

    return 'request cancelled';
  }

  private buildPairCondition(userA: string, userB: string) {
    return or(
      and(eq(requests.senderId, userA), eq(requests.receiverId, userB)),
      and(eq(requests.senderId, userB), eq(requests.receiverId, userA)),
    );
  }
}
