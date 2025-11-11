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
    const { skills: skillNames, attitudes: attitudeNames, interests: interestNames, ...profileData } =
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
    if (skillNames && skillNames.length > 0) {
      await this.updateUserSkills(userId, skillNames);
    }

    // Update attitudes if provided
    if (attitudeNames && attitudeNames.length > 0) {
      await this.updateUserAttitudes(userId, attitudeNames);
    }

    // Update interests if provided
    if (interestNames && interestNames.length > 0) {
      await this.updateUserInterests(userId, interestNames);
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
  private async updateUserSkills(userId: string, skillNames: string[]) {
    // Delete existing skills
    await this.db.delete(userSkills).where(eq(userSkills.userId, userId));

    if (skillNames.length === 0) return;

    // Get or create skills
    const skillRecords = await Promise.all(
      skillNames.map(async (name) => {
        let skill = await this.db.query.skills.findFirst({
          where: eq(skills.name, name),
        });

        if (!skill) {
          [skill] = await this.db
            .insert(skills)
            .values({ name })
            .returning();
        }

        return skill;
      }),
    );

    // Create user-skill associations
    await this.db.insert(userSkills).values(
      skillRecords.map((skill) => ({
        userId,
        skillId: skill.id,
      })),
    );
  }

  private async updateUserAttitudes(userId: string, attitudeNames: string[]) {
    // Delete existing attitudes
    await this.db.delete(userAttitudes).where(eq(userAttitudes.userId, userId));

    if (attitudeNames.length === 0) return;

    // Get or create attitudes
    const attitudeRecords = await Promise.all(
      attitudeNames.map(async (name) => {
        let attitude = await this.db.query.attitudes.findFirst({
          where: eq(attitudes.name, name),
        });

        if (!attitude) {
          [attitude] = await this.db
            .insert(attitudes)
            .values({ name })
            .returning();
        }

        return attitude;
      }),
    );

    // Create user-attitude associations
    await this.db.insert(userAttitudes).values(
      attitudeRecords.map((attitude) => ({
        userId,
        attitudeId: attitude.id,
      })),
    );
  }

  private async updateUserInterests(userId: string, interestNames: string[]) {
    // Delete existing interests
    await this.db.delete(userInterests).where(eq(userInterests.userId, userId));

    if (interestNames.length === 0) return;

    // Get or create interests
    const interestRecords = await Promise.all(
      interestNames.map(async (name) => {
        let interest = await this.db.query.interests.findFirst({
          where: eq(interests.name, name),
        });

        if (!interest) {
          [interest] = await this.db
            .insert(interests)
            .values({ name })
            .returning();
        }

        return interest;
      }),
    );

    // Create user-interest associations
    await this.db.insert(userInterests).values(
      interestRecords.map((interest) => ({
        userId,
        interestId: interest.id,
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
}