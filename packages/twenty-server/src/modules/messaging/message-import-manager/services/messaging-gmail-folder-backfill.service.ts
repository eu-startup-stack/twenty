import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import {
  ConnectedAccountProvider,
  MessageFolderImportPolicy,
  MessageFolderPendingSyncAction,
} from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { In, Repository } from 'typeorm';

import { MessageChannelEntity } from 'src/engine/metadata-modules/message-channel/entities/message-channel.entity';
import { MessageFolderEntity } from 'src/engine/metadata-modules/message-folder/entities/message-folder.entity';
import { GmailGetMessageListService } from 'src/modules/messaging/message-import-manager/drivers/gmail/services/gmail-get-message-list.service';
import { type MessageFolder } from 'src/modules/messaging/message-folder-manager/interfaces/message-folder-driver.interface';

@Injectable()
export class MessagingGmailFolderBackfillService {
  private readonly logger = new Logger(
    MessagingGmailFolderBackfillService.name,
  );

  constructor(
    private readonly gmailGetMessageListService: GmailGetMessageListService,
    @InjectRepository(MessageFolderEntity)
    private readonly messageFolderRepository: Repository<MessageFolderEntity>,
  ) {}

  async collectFolderImportIds(
    messageChannel: MessageChannelEntity,
    messageFolders: MessageFolder[],
    workspaceId: string,
  ): Promise<string[]> {
    if (
      !isDefined(messageChannel.connectedAccount) ||
      messageChannel.connectedAccount.provider !==
        ConnectedAccountProvider.GOOGLE
    ) {
      return [];
    }

    const foldersToImport = messageFolders.filter(
      (folder) =>
        folder.pendingSyncAction ===
        MessageFolderPendingSyncAction.FOLDER_IMPORT,
    );

    if (foldersToImport.length === 0) {
      return [];
    }

    const messageExternalIds: string[] = [];

    for (const folderToImport of foldersToImport) {
      const foldersScopedToImport = messageFolders.map((folder) => ({
        name: folder.name,
        externalId: folder.externalId,
        parentFolderId: folder.parentFolderId,
        isSynced: folder.id === folderToImport.id,
      }));

      const [messageList] =
        await this.gmailGetMessageListService.getMessageListWithoutCursor(
          messageChannel.connectedAccount,
          foldersScopedToImport,
          {
            messageFolderImportPolicy:
              MessageFolderImportPolicy.SELECTED_FOLDERS,
          },
        );

      messageExternalIds.push(...(messageList?.messageExternalIds ?? []));
    }

    await this.messageFolderRepository.update(
      {
        id: In(foldersToImport.map((folder) => folder.id)),
        workspaceId,
      },
      { pendingSyncAction: MessageFolderPendingSyncAction.NONE },
    );

    this.logger.log(
      `WorkspaceId: ${workspaceId}, MessageChannelId: ${messageChannel.id} - Collected ${messageExternalIds.length} message(s) from ${foldersToImport.length} folder(s) for backfill import`,
    );

    return messageExternalIds;
  }
}
