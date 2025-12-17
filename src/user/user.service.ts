import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../database/database.module';
import {
  users,
  skills,
  userSkills,
  attitudes,
  userAttitudes,
  interests,
  userInterests,
  userLocations,
} from '../database/schema';
import {
  UpdateProfileDto,
  UpdateSkillsDto,
  UpdateAttitudesDto,
  UpdateInterestsDto,
  CompleteProfileDto,
  UpdateLocationDto,
  UpdatePushTokenDto,
  UserResponseDto,
} from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE_CONNECTION) private db: any) {}

  async getProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        skills: {
          with: {
            skill: true,
          },
        },
        attitudes: {
          with: {
            attitude: true,
          },
        },
        interests: {
          with: {
            interest: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.formatUserResponse(user);
  }

  async getUserById(userId: string): Promise<UserResponseDto> {
    return this.getProfile(userId);
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.db
      .update(users)
      .set({
        ...updateProfileDto,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return this.getProfile(userId);
  }

  async completeProfile(
    userId: string,
    completeProfileDto: CompleteProfileDto,
  ): Promise<UserResponseDto> {
    const { skills: skillIds, attitudes: attitudeIds, interests: interestIds, ...profileData } =
      completeProfileDto;

    // Update basic profile
    await this.db
      .update(users)
      .set({
        ...profileData,
        profileCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Update skills if provided
    if (skillIds && skillIds.length > 0) {
      await this.updateUserSkills(userId, skillIds);
    }

    // Update attitudes if provided
    if (attitudeIds && attitudeIds.length > 0) {
      await this.updateUserAttitudes(userId, attitudeIds);
    }

    // Update interests if provided
    if (interestIds && interestIds.length > 0) {
      await this.updateUserInterests(userId, interestIds);
    }

    return this.getProfile(userId);
  }

  async updateSkills(
    userId: string,
    updateSkillsDto: UpdateSkillsDto,
  ): Promise<{ message: string; skills: any[] }> {
    await this.updateUserSkills(userId, updateSkillsDto.skills);

    const userProfile = await this.getProfile(userId);

    return {
      message: 'Skills updated successfully',
      skills: userProfile.skills || [],
    };
  }

  async updateAttitudes(
    userId: string,
    updateAttitudesDto: UpdateAttitudesDto,
  ): Promise<{ message: string; attitudes: any[] }> {
    await this.updateUserAttitudes(userId, updateAttitudesDto.attitudes);

    const userProfile = await this.getProfile(userId);

    return {
      message: 'Attitudes updated successfully',
      attitudes: userProfile.attitudes || [],
    };
  }

  async updateInterests(
    userId: string,
    updateInterestsDto: UpdateInterestsDto,
  ): Promise<{ message: string; interests: any[] }> {
    await this.updateUserInterests(userId, updateInterestsDto.interests);

    const userProfile = await this.getProfile(userId);

    return {
      message: 'Interests updated successfully',
      interests: userProfile.interests || [],
    };
  }

  async updateLocation(
    userId: string,
    updateLocationDto: UpdateLocationDto,
  ): Promise<{ message: string }> {
    // Mark all previous locations as not current
    await this.db
      .update(userLocations)
      .set({ isCurrent: false })
      .where(eq(userLocations.userId, userId));

    // Add new location
    await this.db.insert(userLocations).values({
      userId,
      ...updateLocationDto,
      isCurrent: true,
      startDate: new Date(),
    });

    return { message: 'Location updated successfully' };
  }

  async getLocations(userId: string) {
    const locations = await this.db.query.userLocations.findMany({
      where: eq(userLocations.userId, userId),
      orderBy: (userLocations, { desc }) => [desc(userLocations.startDate)],
    });

    return locations;
  }

  async deleteAccount(userId: string): Promise<{ message: string }> {
    await this.db.delete(users).where(eq(users.id, userId));

    return { message: 'Account deleted successfully' };
  }

  // Helper methods
  private async updateUserSkills(userId: string, skillIds: string[]) {
    // Delete existing skills
    await this.db.delete(userSkills).where(eq(userSkills.userId, userId));

    if (skillIds.length === 0) return;

    // Validate that all skill IDs exist
    const existingSkills = await this.db.query.skills.findMany({
      where: inArray(skills.id, skillIds),
    });

    if (existingSkills.length !== skillIds.length) {
      const foundIds = existingSkills.map(s => s.id);
      const missingIds = skillIds.filter(id => !foundIds.includes(id));
      throw new BadRequestException(
        `Invalid skill IDs: ${missingIds.join(', ')}`
      );
    }

    // Create user-skill associations
    await this.db.insert(userSkills).values(
      skillIds.map((skillId) => ({
        userId,
        skillId,
      })),
    );
  }

  private async updateUserAttitudes(userId: string, attitudeIds: string[]) {
    // Delete existing attitudes
    await this.db.delete(userAttitudes).where(eq(userAttitudes.userId, userId));

    if (attitudeIds.length === 0) return;

    // Validate that all attitude IDs exist
    const existingAttitudes = await this.db.query.attitudes.findMany({
      where: inArray(attitudes.id, attitudeIds),
    });

    if (existingAttitudes.length !== attitudeIds.length) {
      const foundIds = existingAttitudes.map(a => a.id);
      const missingIds = attitudeIds.filter(id => !foundIds.includes(id));
      throw new BadRequestException(
        `Invalid attitude IDs: ${missingIds.join(', ')}`
      );
    }

    // Create user-attitude associations
    await this.db.insert(userAttitudes).values(
      attitudeIds.map((attitudeId) => ({
        userId,
        attitudeId,
      })),
    );
  }

  private async updateUserInterests(userId: string, interestIds: string[]) {
    // Delete existing interests
    await this.db.delete(userInterests).where(eq(userInterests.userId, userId));

    if (interestIds.length === 0) return;

    // Validate that all interest IDs exist
    const existingInterests = await this.db.query.interests.findMany({
      where: inArray(interests.id, interestIds),
    });

    if (existingInterests.length !== interestIds.length) {
      const foundIds = existingInterests.map(i => i.id);
      const missingIds = interestIds.filter(id => !foundIds.includes(id));
      throw new BadRequestException(
        `Invalid interest IDs: ${missingIds.join(', ')}`
      );
    }

    // Create user-interest associations
    await this.db.insert(userInterests).values(
      interestIds.map((interestId) => ({
        userId,
        interestId,
      })),
    );
  }

  private formatUserResponse(user: any): UserResponseDto {
    const { password, mfaSecret, ...userData } = user;

    return {
      ...userData,
      skills: user.skills?.map((us: any) => us.skill) || [],
      attitudes: user.attitudes?.map((ua: any) => ua.attitude) || [],
      interests: user.interests?.map((ui: any) => ui.interest) || [],
    };
  }

  // Get available options
  async getAvailableSkills() {
    return await this.db.query.skills.findMany();
  }

  async getAvailableAttitudes() {
    return await this.db.query.attitudes.findMany();
  }

  async getAvailableInterests() {
    return await this.db.query.interests.findMany();
  }

  async updatePushToken(
    userId: string,
    updatePushTokenDto: UpdatePushTokenDto,
  ): Promise<{ message: string }> {
    await this.db
      .update(users)
      .set({ pushToken: updatePushTokenDto.pushToken })
      .where(eq(users.id, userId));

    return { message: 'Push token updated successfully' };
  }

  async removePushToken(userId: string): Promise<{ message: string }> {
    await this.db
      .update(users)
      .set({ pushToken: null })
      .where(eq(users.id, userId));

    return { message: 'Push token removed successfully' };
  }
}