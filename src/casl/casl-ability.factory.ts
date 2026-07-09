import {
  AbilityBuilder,
  createMongoAbility,
  ForcedSubject,
  MongoAbility,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { Action } from './action.enum';

// String subject types keep authorization consistent between coarse checks
// (`can(Action.Create, 'City')`) and record-level checks on Mongoose documents
// tagged with `subject('City', doc)` — Mongoose docs don't carry our classes.
export type SubjectName =
  | 'User'
  | 'City'
  | 'TouristSite'
  | 'Gallery'
  | 'HistoricalFigure'
  | 'Media';

export type Subjects = SubjectName | ForcedSubject<SubjectName> | 'all';

export type AppAbility = MongoAbility<[Action, Subjects]>;

// The authenticated principal we build abilities from.
export interface RequestUser {
  userId: string;
  email: string;
  role: Role;
}

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: RequestUser): AppAbility {
    // Untyped builder so rule conditions accept plain Mongo query objects;
    // the built ability is exposed through the typed `AppAbility` alias.
    const { can, build } = new AbilityBuilder(createMongoAbility);

    if (user.role === Role.ADMIN) {
      // Admin can do everything.
      can(Action.Manage, 'all');
    } else if (user.role === Role.EDITOR) {
      // Editors read everything and manage the content they created.
      can(Action.Read, 'City');
      can(Action.Read, 'TouristSite');
      can(Action.Read, 'Gallery');
      can(Action.Read, 'HistoricalFigure');
      can(Action.Read, 'Media');
      can(Action.Create, 'City');
      can(Action.Create, 'TouristSite');
      can(Action.Create, 'Gallery');
      can(Action.Create, 'HistoricalFigure');
      can(Action.Create, 'Media');
      can([Action.Update, Action.Delete], 'City', { createdBy: user.userId });
      can([Action.Update, Action.Delete], 'TouristSite', {
        createdBy: user.userId,
      });
      can([Action.Update, Action.Delete], 'Gallery', {
        createdBy: user.userId,
      });
      can([Action.Update, Action.Delete], 'HistoricalFigure', {
        createdBy: user.userId,
      });
      can([Action.Update, Action.Delete], 'Media', {
        createdBy: user.userId,
      });
      // Editors may read / update only their own account.
      can([Action.Read, Action.Update], 'User', { _id: user.userId });
    } else {
      // Regular users can only read published content and their own account.
      can(Action.Read, 'City');
      can(Action.Read, 'TouristSite');
      can(Action.Read, 'Gallery');
      can(Action.Read, 'HistoricalFigure');
      can(Action.Read, 'Media');
      can([Action.Read, Action.Update], 'User', { _id: user.userId });
    }

    return build() as AppAbility;
  }
}
